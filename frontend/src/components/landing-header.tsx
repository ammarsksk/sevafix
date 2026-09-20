"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Brand } from "./brand";
import styles from "./landing-header.module.css";

const anchors = [
  ["prepare", "Prepare"],
  ["diagnose", "Diagnose"],
  ["how-it-decides", "How it decides"],
  ["privacy", "Privacy"],
  ["schemes", "Schemes"],
] as const;

export function LandingHeader() {
  const [active, setActive] = useState("prepare");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const sections = anchors.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-22% 0px -62% 0px", threshold: [0, 0.2, 0.5] });
    sections.forEach((section) => observer.observe(section));
    return () => { window.removeEventListener("scroll", onScroll); observer.disconnect(); };
  }, []);

  const links = anchors.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} className={`${styles.navLink} ${active === id ? styles.navActive : ""}`}>{label}</a>);

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
      <div className={`${styles.mainRow} mx-auto max-w-[1440px]`}>
        <Brand />
        <nav className={styles.nav} aria-label="Landing page sections">{links}</nav>
        <div className={styles.actions}><Link href="/login" className={styles.signIn}>Sign in</Link><Link href="/signup?intent=prepare" className={styles.prepare}>Prepare application</Link></div>
      </div>
      <nav className={styles.mobileAnchors} aria-label="Landing page sections">{links}</nav>
      <p className={styles.quietLine}>Independent workspace. Not a government website. You submit on the official portal.</p>
    </header>
  );
}
