<script lang="ts">
    import { cn } from "$lib/utils.js";

    let {
        active = true,
        class: className,
    }: {
        active?: boolean;
        class?: string;
    } = $props();
</script>

{#if active}
    <div
        class={cn(
            "pointer-events-none absolute -top-px right-0 left-0 z-10 h-px overflow-visible",
            className,
        )}
    >
        <!-- Base glow layer — wide, soft -->
        <div
            class="absolute inset-x-0 -top-[1px] h-[3px]"
            style="
				background: linear-gradient(90deg,
					transparent 0%,
					color-mix(in srgb, var(--primary) 30%, transparent) 15%,
					color-mix(in srgb, var(--primary) 70%, transparent) 35%,
					color-mix(in srgb, var(--chart-1) 80%, transparent) 50%,
					color-mix(in srgb, var(--primary) 70%, transparent) 65%,
					color-mix(in srgb, var(--primary) 30%, transparent) 85%,
					transparent 100%
				);
				width: 200%;
				filter: blur(1px);
				animation: aurora-shift 3s ease-in-out infinite;
			"
        ></div>
        <!-- Mid layer — tighter, brighter -->
        <div
            class="absolute inset-x-0 top-0 h-[2px]"
            style="
				background: linear-gradient(90deg,
					transparent 0%,
					color-mix(in srgb, var(--chart-1) 20%, transparent) 20%,
					color-mix(in srgb, var(--primary) 90%, transparent) 38%,
					white 50%,
					color-mix(in srgb, var(--primary) 90%, transparent) 62%,
					color-mix(in srgb, var(--chart-1) 20%, transparent) 80%,
					transparent 100%
				);
				width: 200%;
				animation: aurora-shift 3s ease-in-out infinite;
			"
        ></div>
        <!-- Top bloom — diffuse upward -->
        <div
            class="absolute inset-x-0 -top-[6px] h-[10px]"
            style="
				background: linear-gradient(90deg,
					transparent 0%,
					color-mix(in srgb, var(--primary) 15%, transparent) 25%,
					color-mix(in srgb, var(--chart-1) 25%, transparent) 50%,
					color-mix(in srgb, var(--primary) 15%, transparent) 75%,
					transparent 100%
				);
				width: 200%;
				filter: blur(4px);
				animation: aurora-shift 3s ease-in-out infinite;
			"
        ></div>
    </div>
{/if}
