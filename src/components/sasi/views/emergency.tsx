"use client";

import { Phone, Siren } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { useT } from "@/lib/sasi/i18n";
import { OfficialSource, TrustNotice } from "@/components/sasi/primitives";

/* ============================================================
   EMERGENCY — verified national public contacts for South
   Africa (Task 24, master prompt §17). Speed-first: huge
   numbers, real tel: actions, minimal decoration.

   DATA HONESTY: these are long-established NATIONAL contact
   numbers published through official SA government channels.
   Municipal lines vary locally — the page says so. SASI is
   NOT an emergency service and never dispatches anything;
   every action here is a plain phone call the user makes.
   ============================================================ */

type Contact = {
  /** the number exactly as dialled */
  number: string;
  /** what this line is for */
  label: string;
  /** one-line description */
  copy: string;
  /** hours when published, else undefined */
  hours?: string;
};

const IMMEDIATE: Contact[] = [
  {
    number: "10111",
    label: "Police — SAPS",
    copy: "Crime in progress, danger to life, or needing the police urgently.",
    hours: "24 hours",
  },
  {
    number: "10177",
    label: "Ambulance & fire",
    copy: "Medical emergency, fire, or rescue services.",
    hours: "24 hours",
  },
  {
    number: "112",
    label: "Emergency from a mobile",
    copy: "Works from any cellphone — the operator routes you to police, medical or fire, in your language.",
    hours: "24 hours",
  },
];

const SAFETY_HEALTH: Contact[] = [
  {
    number: "0800 428 428",
    label: "Gender-Based Violence Command Centre",
    copy: "Support, counselling and referral for anyone affected by gender-based violence.",
    hours: "24 hours",
  },
  {
    number: "116",
    label: "Childline SA",
    copy: "Free helpline for children and young people — abuse, safety, or any worry.",
    hours: "24 hours",
  },
  {
    number: "0800 567 567",
    label: "Suicide Crisis Helpline",
    copy: "Crisis counselling when you or someone near you is thinking of self-harm.",
    hours: "24 hours",
  },
  {
    number: "0861 555 777",
    label: "Poison Information Helpline",
    copy: "Immediate guidance for suspected poisoning or overdose.",
  },
  {
    number: "0800 029 999",
    label: "Disease outbreak hotline (NICD)",
    copy: "Public health concerns and suspected notifiable disease cases.",
  },
];

const SERVICES_UTILITIES: Contact[] = [
  {
    number: "08600 37566",
    label: "Eskom power faults",
    copy: "Reporting electricity outages and dangerous infrastructure on the national grid.",
  },
];

function ContactRow({ c }: { c: Contact }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[22px] font-semibold tracking-tight text-white sm:text-[26px]">
          {c.number}
        </p>
        <p className="mt-0.5 text-[13.5px] font-medium text-zinc-200">{c.label}</p>
        <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-zinc-500">{c.copy}</p>
        {c.hours ? (
          <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-zinc-600">
            <span className="sasi-breathe h-1.5 w-1.5 rounded-full bg-[#66bb6a]" />
            {c.hours}
          </p>
        ) : null}
      </div>
      <a
        href={`tel:${c.number.replace(/\s+/g, "")}`}
        className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-white px-5 text-[13.5px] font-semibold text-black transition-transform hover:bg-zinc-200 active:scale-[0.97]"
        aria-label={`Call ${c.label} on ${c.number}`}
      >
        <Phone className="h-4 w-4" aria-hidden />
        Call
      </a>
    </div>
  );
}

function ContactGroup({
  title,
  contacts,
  danger = false,
}: {
  title: string;
  contacts: Contact[];
  danger?: boolean;
}) {
  return (
    <section aria-labelledby={`cg-${title.replace(/\s+/g, "-").toLowerCase()}`} className="mt-8 first:mt-0">
      <h2
        id={`cg-${title.replace(/\s+/g, "-").toLowerCase()}`}
        className="text-[13px] font-semibold tracking-wide text-white"
      >
        {title}
      </h2>
      <div
        className={
          "sasi-card mt-3 divide-y divide-white/[0.05] px-0 py-0" +
          (danger ? " border-[#ef5350]/25" : "")
        }
      >
        {contacts.map((c) => (
          <ContactRow key={c.number} c={c} />
        ))}
      </div>
    </section>
  );
}

export default function EmergencyView() {
  const t = useT();
  const navigate = useSasiStore((s) => s.navigate);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
      {/* header */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ef5350]/30 bg-[#ef5350]/[0.08]">
          <Siren className="h-5 w-5 text-[#ef5350]" aria-hidden />
        </span>
        <div>
          <h1 className="sasi-serif text-[24px] font-semibold tracking-tight text-white sm:text-[27px]">
            {t("emergency.title")}
          </h1>
          <p className="text-[12.5px] text-zinc-500">{t("emergency.sub")}</p>
        </div>
      </div>

      <TrustNotice variant="warning" className="mt-6">
        SASI is not an emergency service and cannot dispatch help. If someone is in danger right
        now, call <a href="tel:112" className="font-semibold text-white underline decoration-white/30 underline-offset-2">112</a> (mobile) or{" "}
        <a href="tel:10111" className="font-semibold text-white underline decoration-white/30 underline-offset-2">10111</a>. Numbers below are national
        public contacts — your municipality may publish its own local lines for fire and medical
        services.
      </TrustNotice>

      <ContactGroup title="Immediate danger" contacts={IMMEDIATE} danger />
      <ContactGroup title="Personal safety & health" contacts={SAFETY_HEALTH} />
      <ContactGroup title="Services & utilities" contacts={SERVICES_UTILITIES} />

      {/* how to use this page */}
      <section aria-labelledby="em-how" className="mt-8 rounded-xl border border-white/8 bg-white/[0.02] p-4 sm:p-5">
        <h2 id="em-how" className="text-[13px] font-semibold text-white">
          When you call
        </h2>
        <ul className="mt-2.5 space-y-1.5 text-[12.5px] leading-relaxed text-zinc-400">
          <li>· Say where you are first — the nearest landmark, street or suburb.</li>
          <li>· Say what happened and whether anyone is hurt.</li>
          <li>· Stay on the line until the operator says to hang up.</li>
          <li>· If a line does not connect, dial 112 from any mobile phone.</li>
        </ul>
      </section>

      <OfficialSource
        title="National government contact directory"
        organisation="South African Government (gov.za)"
        href="https://www.gov.za/contact"
        note="SASI does not operate these lines and cannot verify availability at any moment. If a published number changes, the government directory is the authority."
        className="mt-8"
      />

      {/* civic follow-up — real next step after the emergency passes */}
      <div className="mt-8 rounded-xl border border-white/8 bg-white/[0.02] p-4 sm:p-5">
        <p className="text-[13px] font-semibold text-white">Was this about a service failure?</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
          For outages, leaks or damaged infrastructure, SASI can help you structure a report with
          evidence after you are safe. Nothing is sent anywhere without your approval.
        </p>
        <button
          onClick={() => navigate("report")}
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-[13px] font-medium text-zinc-200 transition-colors hover:border-white/25 hover:text-white active:scale-[0.98]"
        >
          {t("landing.cta.report")}
        </button>
      </div>
    </div>
  );
}
