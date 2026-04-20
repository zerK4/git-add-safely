<script lang="ts">
  import { onMount } from "svelte";
  import { scaleBand } from "d3-scale";
  import { BarChart } from "layerchart";
  import { cubicInOut } from "svelte/easing";
  import { GitCommit, TrendingUp, TrendingDown, GitPullRequest, GitBranch, Clock } from "@lucide/svelte";
  import * as Chart from "$lib/components/ui/chart/index.js";
  import { store, loadUserStats } from "$lib/stores/app.svelte";

  onMount(() => { loadUserStats(); });

  function formatRelative(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const chartConfig = {
    commits: { label: "Commits", color: "var(--chart-1)" },
  } satisfies Chart.ChartConfig;

  const chartData = $derived.by(() => {
    const stats = store.userStats;
    if (!stats) return [];
    const now = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en", { month: "short", day: "numeric" });
      return { date: label, commits: stats.commitsPerDay[key] ?? 0 };
    }).filter(d => d.commits > 0);
  });
</script>

{#if store.userStatsLoading}
  <div class="p-4 flex items-center gap-2 text-muted-foreground text-xs font-sans">
    <span class="animate-pulse">Loading stats...</span>
  </div>
{:else if store.userStats}
  {@const s = store.userStats}
  <div class="w-full p-4 flex flex-col gap-3">
    <!-- Author row -->
    <div class="flex items-center gap-2">
      <div class="size-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold font-sans shrink-0">
        {s.author.name.slice(0, 2).toUpperCase()}
      </div>
      <div class="flex flex-col min-w-0">
        <span class="text-xs font-semibold font-sans text-foreground truncate">{s.author.name}</span>
        <span class="text-[10px] text-muted-foreground font-sans truncate">{s.author.email}</span>
      </div>
      <div class="ml-auto flex items-center gap-1 text-muted-foreground shrink-0">
        <Clock class="size-3" />
        <span class="text-[10px] font-sans">{formatRelative(s.lastCommit)}</span>
      </div>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-2 gap-2 w-full">
      <div class="bg-card border border-border rounded-md px-3 py-2 flex flex-col gap-0.5">
        <div class="flex items-center gap-1 text-muted-foreground">
          <GitCommit class="size-3" />
          <span class="text-[10px] font-sans">Commits (30d)</span>
        </div>
        <span class="text-lg font-bold font-mono text-foreground leading-none">{s.commitsLast30}</span>
      </div>

      <div class="bg-card border border-border rounded-md px-3 py-2 flex flex-col gap-0.5">
        <div class="flex items-center gap-1 text-muted-foreground">
          <GitBranch class="size-3" />
          <span class="text-[10px] font-sans">Ahead of main</span>
        </div>
        <span class="text-lg font-bold font-mono text-foreground leading-none">{s.branchAhead}</span>
      </div>

      <div class="bg-card border border-border rounded-md px-3 py-2 flex flex-col gap-0.5">
        <div class="flex items-center gap-1 text-status-good">
          <TrendingUp class="size-3" />
          <span class="text-[10px] font-sans">Lines added</span>
        </div>
        <span class="text-lg font-bold font-mono text-status-good leading-none">+{s.linesAdded.toLocaleString()}</span>
      </div>

      <div class="bg-card border border-border rounded-md px-3 py-2 flex flex-col gap-0.5">
        <div class="flex items-center gap-1 text-destructive">
          <TrendingDown class="size-3" />
          <span class="text-[10px] font-sans">Lines removed</span>
        </div>
        <span class="text-lg font-bold font-mono text-destructive leading-none">-{s.linesRemoved.toLocaleString()}</span>
      </div>
    </div>

    <!-- Bar chart -->
    {#if s.commitsLast30 > 0}
      <div class="bg-card border border-border rounded-md px-3 pt-2 pb-1 flex flex-col gap-1 w-full">
        <span class="text-[10px] font-sans text-muted-foreground">Commit activity (30d)</span>
        <Chart.Container config={chartConfig} class="h-16 w-full">
          <BarChart
            data={chartData}
            xScale={scaleBand().padding(0.2)}
            x="date"
            series={[{ key: "commits", label: "Commits", color: chartConfig.commits.color }]}
            props={{
              bars: {
                stroke: "none",
                rounded: "all",
                radius: 3,
                motion: { type: "tween", duration: 400, easing: cubicInOut },
              },
              highlight: { area: { fill: "none" } },
            }}
          >
            {#snippet tooltip()}
              <Chart.Tooltip hideLabel />
            {/snippet}
          </BarChart>
        </Chart.Container>
      </div>
    {/if}

    <!-- PR stats -->
    {#if s.prs.open > 0 || s.prs.merged > 0 || s.prs.closed > 0}
      <div class="bg-card border border-border rounded-md px-3 py-2 flex flex-col gap-1.5 w-full">
        <div class="flex items-center gap-1 text-muted-foreground">
          <GitPullRequest class="size-3" />
          <span class="text-[10px] font-sans">Pull requests</span>
        </div>
        <div class="flex gap-2 flex-wrap">
          {#if s.prs.open > 0}
            <span class="text-[10px] font-sans px-1.5 py-0.5 rounded bg-status-good/15 text-status-good">{s.prs.open} open</span>
          {/if}
          {#if s.prs.merged > 0}
            <span class="text-[10px] font-sans px-1.5 py-0.5 rounded bg-primary/15 text-primary">{s.prs.merged} merged</span>
          {/if}
          {#if s.prs.closed > 0}
            <span class="text-[10px] font-sans px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.prs.closed} closed</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
