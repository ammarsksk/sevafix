import type { ReactNode } from "react";

import { AppIcon } from "./icons";

export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-5xl border border-[#dfe3e8] bg-white lg:grid-cols-[0.82fr_1.18fr]">
      <aside className="hidden border-r border-[#dfe3e8] bg-[#f4f6f8] p-10 lg:flex lg:flex-col">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-[#173f73] text-white"><AppIcon name="shield" size={20} /></span>
        <p className="eyebrow mt-8">Independent by design</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[#172033]">A private place to prepare important applications.</h2>
        <p className="mt-4 text-sm leading-6 text-[#5f6878]">SevaFix helps you check information and documents. You remain responsible for submitting through the official government portal.</p>
        <dl className="mt-10 divide-y divide-[#dfe3e8] border-y border-[#dfe3e8]">
          {[
            ["Documents", "Private, signed access"],
            ["Checks", "Evidence and reviewed policy"],
            ["Decisions", "Made only by the authority"],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[96px_1fr] gap-4 py-4 text-sm">
              <dt className="font-semibold text-[#172033]">{label}</dt>
              <dd className="text-[#5f6878]">{value}</dd>
            </div>
          ))}
        </dl>
      </aside>

      <section className="p-6 sm:p-10 lg:p-14">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#172033]">{title}</h1>
        <p className="mt-3 max-w-md text-base leading-7 text-[#5f6878]">{description}</p>
        <div className="mt-8">{children}</div>
        {footer ? <div className="mt-7 border-t border-[#dfe3e8] pt-5 text-sm text-[#5f6878]">{footer}</div> : null}
      </section>
    </div>
  );
}
