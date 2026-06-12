import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { FlagDefinition, FlagDoc, FlagEvaluation } from "./types.js";

/**
 * The component's function references, as exposed on the host via
 * `components.flags`.
 */
export interface FlagsComponent {
  mutations: {
    define: FunctionReference<
      "mutation",
      "internal",
      { key: string; value: boolean; description?: string },
      string
    >;
    enable: FunctionReference<"mutation", "internal", { key: string }, null>;
    disable: FunctionReference<"mutation", "internal", { key: string }, null>;
    remove: FunctionReference<"mutation", "internal", { key: string }, null>;
  };
  queries: {
    get: FunctionReference<"query", "internal", { key: string }, FlagDoc | null>;
    list: FunctionReference<"query", "internal", Record<string, never>, FlagDoc[]>;
    evaluate: FunctionReference<
      "query",
      "internal",
      { key: string },
      FlagEvaluation
    >;
    all: FunctionReference<
      "query",
      "internal",
      Record<string, never>,
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
 * auth: gate the management methods (`define`, `enable`, `disable`, `remove`)
 * behind your own authorized mutations.
 *
 * @example
 * ```ts
 * const flags = new Flags(components.flags);
 * if (await flags.isEnabled(ctx, "new-checkout")) { ... }
 * ```
 */
export class Flags {
  constructor(private readonly component: FlagsComponent) {}

  /** Create a flag, or update it if the key already exists. Returns its id. */
  define(ctx: RunMutationCtx, definition: FlagDefinition): Promise<string> {
    return ctx.runMutation(this.component.mutations.define, definition);
  }

  /** Turn a flag on. Throws `FLAG_NOT_FOUND` if the key is undefined. */
  enable(ctx: RunMutationCtx, key: string): Promise<null> {
    return ctx.runMutation(this.component.mutations.enable, { key });
  }

  /** Turn a flag off. Throws `FLAG_NOT_FOUND` if the key is undefined. */
  disable(ctx: RunMutationCtx, key: string): Promise<null> {
    return ctx.runMutation(this.component.mutations.disable, { key });
  }

  /** Permanently delete a flag. Throws `FLAG_NOT_FOUND` if the key is undefined. */
  remove(ctx: RunMutationCtx, key: string): Promise<null> {
    return ctx.runMutation(this.component.mutations.remove, { key });
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
  evaluate(ctx: RunQueryCtx, key: string): Promise<FlagEvaluation> {
    return ctx.runQuery(this.component.queries.evaluate, { key });
  }

  /** Evaluate a flag and return just its boolean value (default `false`). */
  async isEnabled(ctx: RunQueryCtx, key: string): Promise<boolean> {
    return (await this.evaluate(ctx, key)).value;
  }

  /** Evaluate every flag — the bootstrap payload for a reactive client. */
  all(ctx: RunQueryCtx): Promise<Record<string, FlagEvaluation>> {
    return ctx.runQuery(this.component.queries.all, {});
  }
}

export type { FlagDefinition, FlagDoc, FlagEvaluation };
