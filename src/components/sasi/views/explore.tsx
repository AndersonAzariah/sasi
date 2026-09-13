"use client";

/* ============================================================
   SASI — EXPLORE (Task 29)

   The discovery layer: services, government organisations,
   civic topics and public information — one connected network.

   HONESTY RULES (mirrors explore-data.ts / services-registry.ts):
   - Nothing is counted, rated or fabricated. Sections render the
     real registry / explore-data content and nothing else.
   - A verified website is shown ONLY when the data says so; a
     missing website is stated plainly, never guessed.
   - SASI never implies endorsement by any organisation.
   ============================================================ */

import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  Compass,
  ExternalLink,
  Landmark,
  MapPin,
  Route,
  Search,
  Siren,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import {
  CIVIC_TOPICS,
  INFO_INDEX,
  ORGANISATIONS,
  type CivicTopic,
  type OrganisationEntry,
} from "@/lib/sasi/explore-data";
import {
  LOCATION_CATEGORY_LABELS,
  registryEntryBySlug,
  type ServiceRegistryEntry,
} from "@/lib/sasi/services-registry";
import { servicesByCategory } from "@/lib/sasi/search";
import type { View } from "@/lib/sasi/types";
import { EmptyState, GhostButton } from "@/components/sasi/primitives";
import { cn } from "@/lib/utils";

/* Shared section rise (same feel as services / service-detail views) */
const rise = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.45, ease: "easeOut" as const },
};

/* ------------------------------------------------------------
   Small shared pieces
   ------------------------------------------------------------ */

function SphereBadge({ sphere }: { sphere: OrganisationEntry["sphere"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border border-white/10 bg-white/[0.03] px-1.5 py-px",
        "font-mono text-[10px] font-semibold tracking-[0.14em] text-zinc-400"
      )}
    >
      {sphere === "national" ? "NATIONAL" : "MUNICIPAL"}
    </span>
  );
}

/** Compact service row — the shared row style across the whole view. */
function ServiceRow({
  entry,
  onOpen,
}: {
  entry: ServiceRegistryEntry;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.035] focus-visible:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/25"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-white">
            {entry.title}
          </span>
          <span className="block truncate text-[11.5px] text-zinc-500">
            {entry.department}
          </span>
        </span>
        {entry.journeyId ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            <Route className="h-3 w-3" aria-hidden />
            Checklist
          </span>
        ) : null}
        {entry.officialSource?.verified ? (
          <BadgeCheck
            className="h-4 w-4 shrink-0 text-[#66bb6a]"
            aria-label="Official source verified"
          />
        ) : null}
        <ArrowRight
          className="h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-300"
          aria-hidden
        />
      </button>
    </li>
  );
}

/** A category block: mono label + compact bordered list of service rows. */
function CategoryBlock({
  label,
  services,
  onOpen,
}: {
  label: string;
  services: ServiceRegistryEntry[];
  onOpen: (slug: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.015]">
        {services.map((entry) => (
          <ServiceRow key={entry.slug} entry={entry} onOpen={() => onOpen(entry.slug)} />
        ))}
      </ul>
    </div>
  );
}

/** Honest back row used by both detail panels. */
function PanelBackRow({ onBack }: { onBack: () => void }) {
  return (
    <GhostButton
      onClick={onBack}
      className="mb-6 h-8 px-3 text-[12.5px]"
      aria-label="Back to Explore"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      Explore
    </GhostButton>
  );
}

function PanelNotFound({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <div className="py-10">
      <PanelBackRow onBack={onBack} />
      <EmptyState
        icon={Compass}
        title={title}
        description={description}
        action={<GhostButton onClick={onBack}>Back to Explore</GhostButton>}
      />
    </div>
  );
}

/** Public-information card (used on the main page and in topic panels). */
function InfoCard({
  view,
  title,
  description,
  onOpen,
}: {
  view: string;
  title: string;
  description: string;
  onOpen: (view: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(view)}
        className="sasi-card sasi-card-interactive group flex min-h-[44px] w-full flex-col p-4 text-left"
        aria-label={`${title} — open public information page`}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[13.5px] font-medium text-white">
            {title}
          </span>
          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-300"
            aria-hidden
          />
        </span>
        <span className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
          {description}
        </span>
      </button>
    </li>
  );
}

/* ============================================================
   MAIN EXPLORE PAGE
   ============================================================ */

function ExploreHome({
  param,
  navigate,
  setCommandOpen,
}: {
  param: string | null;
  navigate: (view: View, param?: string) => void;
  setCommandOpen: (open: boolean) => void;
}) {
  const categories = useMemo(() => servicesByCategory(), []);
  const featured = categories.slice(0, 3);
  const rest = categories.slice(3);

  const openService = (slug: string) => navigate("service-detail", slug);
  const openInfo = (view: string) => navigate(view as View);

  return (
    <div className="pb-6">
      {/* ---------- Header ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="explore-heading"
      >
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Explore
        </p>
        <h1
          id="explore-heading"
          className="sasi-serif mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-white sm:text-3xl"
        >
          South African civic services, explained.
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-zinc-400">
          Services, organisations and public information — grouped so you can find
          your way. SASI lists only what it can verify; where it cannot, it says so.
        </p>

        {/* Search — opens the same command palette as ⌘K */}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label="Search SASI — opens the command palette"
          className="sasi-command-focus mt-6 flex h-12 w-full max-w-xl items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-left transition-colors hover:border-white/20"
        >
          <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[14px] text-zinc-500">
            Search SASI — services, organisations, topics…
          </span>
          <kbd className="hidden shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline-block">
            ⌘K
          </kbd>
        </button>
      </motion.section>

      {/* ---------- Browse by topic ---------- */}
      <motion.section className="mt-10" {...rise} aria-labelledby="explore-topics-heading">
        <h2 id="explore-topics-heading" className="text-[15px] font-semibold tracking-tight text-white">
          Browse by topic
        </h2>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-zinc-500">
          Neutral groupings of real services and information — not a synthetic map.
        </p>
        <div role="group" aria-label="Civic topics" className="mt-4 flex flex-wrap gap-2">
          {CIVIC_TOPICS.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => navigate("explore", `topic:${topic.id}`)}
              aria-pressed={param === `topic:${topic.id}`}
              className="inline-flex min-h-[44px] items-center rounded-full border border-white/10 bg-white/[0.02] px-4 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/25 hover:bg-white/[0.05] hover:text-white aria-pressed:border-[#e3c567]/40 aria-pressed:bg-[#e3c567]/[0.08] aria-pressed:text-[#efe0a8]"
            >
              {topic.name}
            </button>
          ))}
        </div>
      </motion.section>

      {/* ---------- Services (feature block) ---------- */}
      <motion.section className="mt-12" {...rise} aria-labelledby="explore-services-heading">
        <h2 id="explore-services-heading" className="text-[15px] font-semibold tracking-tight text-white">
          Services
        </h2>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-zinc-500">
          Real service guides — requirements, documents to bring and the official
          channel. A checklist chip means SASI can walk you through the preparation.
        </p>

        <div className="mt-5 space-y-6">
          {featured.map((cat) => (
            <CategoryBlock
              key={cat.category}
              label={cat.label}
              services={cat.services}
              onOpen={openService}
            />
          ))}
        </div>

        {/* Remaining categories — real content, expandable */}
        {rest.length > 0 && (
          <details className="group mt-4">
            <summary
              className="flex min-h-[44px] cursor-pointer list-none items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.015] px-4 py-2.5 transition-colors hover:border-white/20 [&::-webkit-details-marker]:hidden"
              aria-label="More services — expand the remaining categories"
            >
              <ChevronDown
                className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180"
                aria-hidden
              />
              <span className="shrink-0 text-[13px] font-medium text-zinc-200">More services</span>
              <span className="min-w-0 truncate text-[11.5px] text-zinc-600">
                {rest.map((c) => c.label).join(" · ")}
              </span>
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {rest.map((cat) => (
                <CategoryBlock
                  key={cat.category}
                  label={cat.label}
                  services={cat.services}
                  onOpen={openService}
                />
              ))}
            </div>
          </details>
        )}
      </motion.section>

      {/* ---------- Government organisations ---------- */}
      <motion.section className="mt-12" {...rise} aria-labelledby="explore-orgs-heading">
        <h2 id="explore-orgs-heading" className="text-[15px] font-semibold tracking-tight text-white">
          Government organisations
        </h2>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-zinc-500">
          Verified institutions only. Where SASI has no verified website on record,
          it says so — no guesses.
        </p>
        <ul className="mt-5 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.015]">
          {ORGANISATIONS.map((org) => (
            <li key={org.id}>
              <button
                type="button"
                onClick={() => navigate("explore", `org:${org.id}`)}
                className="group flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.035] focus-visible:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/25"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-white">
                    {org.name}
                  </span>
                  <span className="block truncate text-[11.5px] text-zinc-500">
                    {org.shortName}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <SphereBadge sphere={org.sphere} />
                  {org.website ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] text-[#a5d6a7]/85">
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#66bb6a]" aria-hidden />
                      Official website verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10.5px] text-zinc-600">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" aria-hidden />
                      No verified website on record
                    </span>
                  )}
                </span>
                <ArrowRight
                  className="hidden h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-300 sm:block"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      </motion.section>

      {/* ---------- Public information ---------- */}
      <motion.section className="mt-12" {...rise} aria-labelledby="explore-info-heading">
        <h2 id="explore-info-heading" className="text-[15px] font-semibold tracking-tight text-white">
          Public information
        </h2>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-zinc-500">
          Short, honest explainers — no sign-in needed.
        </p>
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {INFO_INDEX.map((info) => (
            <InfoCard
              key={info.view}
              view={info.view}
              title={info.title}
              description={info.description}
              onOpen={openInfo}
            />
          ))}
        </ul>
      </motion.section>

      {/* ---------- Directory + emergency strip ---------- */}
      <motion.section className="mt-12" {...rise} aria-labelledby="explore-links-heading">
        <h2 id="explore-links-heading" className="sr-only">
          Government directory and emergency information
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate("gov")}
            className="sasi-card sasi-card-interactive group flex min-h-[44px] w-full items-center gap-3.5 p-4 text-left"
            aria-label="Government directory — open the government view"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
              <Landmark className="h-4 w-4 text-zinc-300" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-white">
                Government directory
              </span>
              <span className="block text-[11.5px] leading-relaxed text-zinc-500">
                National departments, provincial and municipal contacts
              </span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-300"
              aria-hidden
            />
          </button>

          <button
            type="button"
            onClick={() => navigate("emergency")}
            className="sasi-card sasi-card-interactive group flex min-h-[44px] w-full items-center gap-3.5 border-[#ef5350]/20 p-4 text-left hover:border-[#ef5350]/35"
            aria-label="In danger? Open emergency numbers"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#ef5350]/25 bg-[#ef5350]/[0.06]">
              <Siren className="h-4 w-4 text-[#ef5350]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-white">
                <span className="sasi-breathe h-1.5 w-1.5 shrink-0 rounded-full bg-[#ef5350]" aria-hidden />
                In danger?
              </span>
              <span className="block text-[11.5px] leading-relaxed text-zinc-500">
                Emergency numbers → 10111 / 10177
              </span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-[#fda4a0]"
              aria-hidden
            />
          </button>
        </div>
      </motion.section>
    </div>
  );
}

/* ============================================================
   TOPIC PANEL — /?view=explore&p=topic:<id>
   ============================================================ */

function TopicPanel({
  topic,
  navigate,
}: {
  topic: CivicTopic | undefined;
  navigate: (view: View, param?: string) => void;
}) {
  const back = () => navigate("explore");

  if (!topic) {
    return (
      <PanelNotFound
        title="Topic not found"
        description="SASI has no civic topic under that name — it may have been renamed. Browse the topics on the Explore page instead."
        onBack={back}
      />
    );
  }

  /* skip unknown slugs — only real registry entries render */
  const services = topic.serviceSlugs
    .map((slug) => registryEntryBySlug(slug))
    .filter((e): e is ServiceRegistryEntry => e !== undefined);
  const infos = topic.infoViews
    .map((view) => INFO_INDEX.find((i) => i.view === view))
    .filter((i): i is (typeof INFO_INDEX)[number] => i !== undefined);
  const nearbyLabel = topic.locationCategory
    ? LOCATION_CATEGORY_LABELS[topic.locationCategory] ??
      topic.locationCategory.replace(/-/g, " ")
    : null;

  return (
    <div className="pb-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="topic-heading"
      >
        <PanelBackRow onBack={back} />
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Topic
        </p>
        <h2 id="topic-heading" className="mt-2 text-2xl font-semibold tracking-tight text-white">
          {topic.name}
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-zinc-400">
          {topic.description}
        </p>
      </motion.section>

      {/* Services in this topic */}
      <motion.section className="mt-10" {...rise} aria-labelledby="topic-services-heading">
        <h3 id="topic-services-heading" className="text-[15px] font-semibold tracking-tight text-white">
          Services in this topic
        </h3>
        {services.length > 0 ? (
          <ul className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.015]">
            {services.map((entry) => (
              <ServiceRow
                key={entry.slug}
                entry={entry}
                onOpen={() => navigate("service-detail", entry.slug)}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-500">
            SASI has no service guide linked to this topic yet.
          </p>
        )}
      </motion.section>

      {/* Public information for this topic */}
      {infos.length > 0 && (
        <motion.section className="mt-10" {...rise} aria-labelledby="topic-info-heading">
          <h3 id="topic-info-heading" className="text-[15px] font-semibold tracking-tight text-white">
            Public information
          </h3>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {infos.map((info) => (
              <InfoCard
                key={info.view}
                view={info.view}
                title={info.title}
                description={info.description}
                onOpen={(view) => navigate(view as View)}
              />
            ))}
          </ul>
        </motion.section>
      )}

      {/* Nearby — honest place category, map opens without promises */}
      {nearbyLabel && (
        <motion.section className="mt-10" {...rise} aria-labelledby="topic-nearby-heading">
          <h3 id="topic-nearby-heading" className="text-[15px] font-semibold tracking-tight text-white">
            Nearby
          </h3>
          <button
            type="button"
            onClick={() => navigate("map")}
            className="sasi-card sasi-card-interactive group mt-4 flex min-h-[44px] w-full items-center gap-3.5 p-4 text-left"
            aria-label={`Find ${nearbyLabel} near you — open the map`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
              <MapPin className="h-4 w-4 text-zinc-300" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-white">
                Find {nearbyLabel} near you
              </span>
              <span className="block text-[11.5px] leading-relaxed text-zinc-500">
                Opens the SASI map
              </span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-300"
              aria-hidden
            />
          </button>
        </motion.section>
      )}
    </div>
  );
}

/* ============================================================
   ORGANISATION PANEL — /?view=explore&p=org:<id>
   ============================================================ */

function OrgPanel({
  org,
  navigate,
}: {
  org: OrganisationEntry | undefined;
  navigate: (view: View, param?: string) => void;
}) {
  const back = () => navigate("explore");

  if (!org) {
    return (
      <PanelNotFound
        title="Organisation not found"
        description="SASI has no verified record for that organisation. Browse the verified institutions on the Explore page instead."
        onBack={back}
      />
    );
  }

  /* skip unknown slugs — only real registry entries render */
  const services = org.serviceSlugs
    .map((slug) => registryEntryBySlug(slug))
    .filter((e): e is ServiceRegistryEntry => e !== undefined);

  return (
    <div className="pb-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="org-heading"
      >
        <PanelBackRow onBack={back} />
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Government organisation
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 id="org-heading" className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {org.name}
          </h1>
          <SphereBadge sphere={org.sphere} />
        </div>
        <p className="mt-1 text-[12.5px] text-zinc-500">{org.shortName}</p>
      </motion.section>

      {/* Responsibilities */}
      <motion.section className="mt-10" {...rise} aria-labelledby="org-responsibilities-heading">
        <h2 id="org-responsibilities-heading" className="text-[15px] font-semibold tracking-tight text-white">
          Responsibilities
        </h2>
        <ul className="mt-3 space-y-2.5">
          {org.responsibilities.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-zinc-300"
            >
              <span
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600"
                aria-hidden
              />
              {item}
            </li>
          ))}
        </ul>
      </motion.section>

      {/* Services this organisation handles */}
      <motion.section className="mt-10" {...rise} aria-labelledby="org-services-heading">
        <h2 id="org-services-heading" className="text-[15px] font-semibold tracking-tight text-white">
          Handles these services
        </h2>
        {services.length > 0 ? (
          <ul className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.015]">
            {services.map((entry) => (
              <ServiceRow
                key={entry.slug}
                entry={entry}
                onOpen={() => navigate("service-detail", entry.slug)}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-500">
            SASI has no service guide linked to this organisation yet — confirm what
            it offers through the organisation directly.
          </p>
        )}
      </motion.section>

      {/* Official website — verified link or an honest null, never a guess */}
      <motion.section className="mt-10" {...rise} aria-labelledby="org-website-heading">
        <h2 id="org-website-heading" className="text-[15px] font-semibold tracking-tight text-white">
          Official website
        </h2>
        {org.website ? (
          <div className="sasi-card mt-4 p-4">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#a5d6a7]">
              <BadgeCheck className="h-4 w-4 shrink-0 text-[#66bb6a]" aria-hidden />
              Official website verified
            </p>
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={`${org.name} official website (opens in a new tab)`}
              className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] text-zinc-200 transition-colors hover:border-white/25 hover:text-white"
            >
              <span className="min-w-0 break-all">{org.website}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
            <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-600">
              SASI is independent and is not endorsed by this organisation.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.015] p-4">
            <p className="text-[12.5px] leading-relaxed text-zinc-500">
              SASI has no verified website on record for this organisation — confirm
              details through the department directly.
            </p>
          </div>
        )}
      </motion.section>
    </div>
  );
}

/* ============================================================
   VIEW — param-driven: org:<id> / topic:<id> panels, else home
   ============================================================ */

export default function ExploreView() {
  const param = useSasiStore((s) => s.param);
  const navigate = useSasiStore((s) => s.navigate);
  const setCommandOpen = useSasiStore((s) => s.setCommandOpen);

  let content: ReactNode;
  if (param?.startsWith("org:")) {
    const org = ORGANISATIONS.find((o) => o.id === param.slice(4));
    content = <OrgPanel org={org} navigate={navigate} />;
  } else if (param?.startsWith("topic:")) {
    const topic = CIVIC_TOPICS.find((t) => t.id === param.slice(6));
    content = <TopicPanel topic={topic} navigate={navigate} />;
  } else {
    content = (
      <ExploreHome param={param} navigate={navigate} setCommandOpen={setCommandOpen} />
    );
  }

  return <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{content}</main>;
}
