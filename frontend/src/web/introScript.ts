/**
 * Runs inline, before the page is painted (see app/web/layout.tsx): on the
 * first visit of a browser session it marks the website wrapper (.mm-web, the
 * element this script sits in) with .mm-intro-on, which shows the opening
 * curtain (Intro.tsx, motion.css) and holds the hero's animations back until
 * it lifts. Visitors who asked for reduced motion get the same intro as a
 * plain fade (motion.css → "Reduced motion").
 *
 * On the wrapper, not <html>: React resets <html>'s attributes when it
 * hydrates, which wiped the class before the curtain could play.
 * Kept out of Intro.tsx: a server component can't read a string exported from
 * a "use client" file.
 */
export const INTRO_SCRIPT = `try{var w=document.currentScript&&document.currentScript.parentElement;if(w&&!sessionStorage.getItem("mm-intro")){w.classList.add("mm-intro-on");sessionStorage.setItem("mm-intro","1")}}catch(e){}`;
