import { defineComponent } from "convex/server";

/** The flags component definition: mount it with `app.use(flags)` in the host `convex.config.ts`. */
const component = defineComponent("flags");

// Nest official child components here, e.g.:
// import sharded from "@convex-dev/sharded-counter/convex.config";
// component.use(sharded);

export default component;
