import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type {
  EvalContext,
  EvalOptions,
  FlagDefinition,
  FlagDoc,
  FlagEvaluation,
  Rollout,
  Rule,
  Variant,
  VariantValue,
} from "./types.js";

/**
 * The component's function references, as exposed on the host via
 * `components.flags`.
 */
export interface FlagsComponent {
  mutations: {
    define: FunctionReference<
      "mutation",
      "internal",
      {
        key: string;
        value: VariantValue;
        description?: string;
        variants?: Variant[];
        rules?: Rule[];
        rollout?: Rollout;
      },
      string
    >;
    enable: FunctionReference<"mutation", "internal", { key: string }, null>;
    disable: FunctionReference<"mutation", "internal", { key: string }, null>;
    remove: FunctionReference<"mutation", "internal", { key: string }, null>;
    archive: FunctionReference<"mutation", "internal", { key: string }, null>;
    restore: FunctionReference<"mutation", "internal", { key: string }, null>;
    setOverride: FunctionReference<
      "mutation",
      "internal",
      { key: string; subjectRef: string; value: VariantValue },
      null
    >;
    clearOverride: FunctionReference<
      "mutation",
      "internal",
      { key: string; subjectRef: string },
      null
    >;
  };
  queries: {
    get: FunctionReference<"query", "internal", { key: string }, FlagDoc | null>;
    list: FunctionReference<"query", "internal", Record<string, never>, FlagDoc[]>;
    evaluate: FunctionReference<
      "query",
      "internal",
      { key: string; context?: EvalContext; default?: VariantValue },
      FlagEvaluation
    >;
    all: FunctionReference<
      "query",
      "internal",
      { context?: EvalContext },
      Record<string, FlagEvaluation>
    >;
  };
}

interface RunQueryCtx {
  runQuery<Q extends FunctionReference<"query", "internal">>(
    reference: Q,
    args: FunctionArgs<Q>,
  ): Promise<FunctionReturnType<Q>>;
}

interface RunMutationCtx {
  runMutation<M extends FunctionReference<"mutation", "internal">>(
    reference: M,
    args: FunctionArgs<M>,
  ): Promise<FunctionReturnType<M>>;
}

/**
 * Consumer-facing client for `@vllnt/convex-flags`. Construct with the mounted
 * component ref, then call from host queries/mutations/actions. The host owns
 * auth: gate the management methods (`define`, `enable`, `disable`, `archive`,
 * `restore`, `remove`, `setOverride`, `clearOverride`) behind your own
 * authorized mutations.
 *
 * @example
 * ```ts
 * const flags = new Flags(components.flags);
 * if (await flags.isEnabled(ctx, "new-checkout", { subjectRef: userId })) { ... }
 * ```
 */
export class Flags {
  constructor(private readonly component: FlagsComponent) {}

  /** Create a flag, or replace its definition if the key already exists. */
  define(ctx: RunMutationCtx, definition: FlagDefinition): Promise<string> {
    return ctx.runMutation(this.component.mutations.define, definition);
  }

  /** Turn a boolean flag on. Throws `FLAG_NOT_FOUND` if the key is undefined. */
  enable(ctx: RunMutationCtx, key: string): Promise<null> {
    return ctx.runMutation(this.component.mutations.enable, { key });
  }

  /** Turn a boolean flag off. Throws `FLAG_NOT_FOUND` if the key is undefined. */
  disable(ctx: RunMutationCtx, key: string): Promise<null> {
    return ctx.runMutation(this.component.mutations.disable, { key });
  }

  /** Archive a flag (reversible). Throws `FLAG_NOT_FOUND` if the key is undefined. */
  archive(ctx: RunMutationCtx, key: string): Promise<null> {
    return ctx.runMutation(this.component.mutations.archive, { key });
  }

  /** Restore an archived flag. Throws `FLAG_NOT_FOUND` if the key is undefined. */
  restore(ctx: RunMutationCtx, key: string): Promise<null> {
    return ctx.runMutation(this.component.mutations.restore, { key });
  }

  /** Permanently delete a flag and its overrides. Throws `FLAG_NOT_FOUND`. */
  remove(ctx: RunMutationCtx, key: string): Promise<null> {
    return ctx.runMutation(this.component.mutations.remove, { key });
  }

  /** Force a flag's value for one subject. Throws `FLAG_NOT_FOUND`. */
  setOverride(
    ctx: RunMutationCtx,
    key: string,
    subjectRef: string,
    value: VariantValue,
  ): Promise<null> {
    return ctx.runMutation(this.component.mutations.setOverride, {
      key,
      subjectRef,
      value,
    });
  }

  /** Clear a subject's override for a flag. No-op if none exists. */
  clearOverride(
    ctx: RunMutationCtx,
    key: string,
    subjectRef: string,
  ): Promise<null> {
    return ctx.runMutation(this.component.mutations.clearOverride, {
      key,
      subjectRef,
    });
  }

  /** Fetch a single flag definition, or `null` if undefined. */
  get(ctx: RunQueryCtx, key: string): Promise<FlagDoc | null> {
    return ctx.runQuery(this.component.queries.get, { key });
  }

  /** List every flag definition. */
  list(ctx: RunQueryCtx): Promise<FlagDoc[]> {
    return ctx.runQuery(this.component.queries.list, {});
  }

  /** Evaluate a flag, returning its value and the reason it was served. */
  evaluate(
    ctx: RunQueryCtx,
    key: string,
    options?: EvalOptions,
  ): Promise<FlagEvaluation> {
    return ctx.runQuery(this.component.queries.evaluate, {
      key,
      context: options?.context,
      default: options?.default,
    });
  }

  /** Evaluate a flag and return just its value. */
  async variant(
    ctx: RunQueryCtx,
    key: string,
    options?: EvalOptions,
  ): Promise<VariantValue> {
    return (await this.evaluate(ctx, key, options)).value;
  }

  /** Evaluate a boolean flag and return whether it is on (value `=== true`). */
  async isEnabled(
    ctx: RunQueryCtx,
    key: string,
    context?: EvalContext,
  ): Promise<boolean> {
    return (await this.evaluate(ctx, key, { context })).value === true;
  }

  /** Evaluate every flag against optional context — the reactive bootstrap. */
  all(
    ctx: RunQueryCtx,
    context?: EvalContext,
  ): Promise<Record<string, FlagEvaluation>> {
    return ctx.runQuery(this.component.queries.all, { context });
  }
}

export type {
  EvalContext,
  EvalOptions,
  FlagDefinition,
  FlagDoc,
  FlagEvaluation,
  Rollout,
  Rule,
  Variant,
  VariantValue,
};
