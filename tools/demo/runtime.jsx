import React, { useMemo, useSyncExternalStore } from "react";
const listeners = new Set();
let revision = 0;
const jar = new Map([["orion-locale", "ko"]]);
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const notify = () => listeners.forEach((fn) => fn());
export const route = () =>
  new URL(
    location.hash.startsWith("#/") ? location.hash.slice(1) : "/",
    "https://orion.invalid",
  );
export function navigate(href, replace = false) {
  const url = new URL(String(href), route());
  const target = url.pathname + url.search;
  if (replace) nativeReplace(null, "", "#" + target);
  else nativePush(null, "", "#" + target);
  notify();
}
const nativePush = history.pushState.bind(history),
  nativeReplace = history.replaceState.bind(history);
history.pushState = (_state, _unused, url) => navigate(url);
history.replaceState = (_state, _unused, url) => navigate(url, true);
addEventListener("hashchange", notify);
addEventListener("popstate", notify);
export const demoLocation = {
  get pathname() {
    return route().pathname;
  },
  get search() {
    return route().search;
  },
  get hash() {
    return "";
  },
};
export const routeVersion = () => route().pathname + ":" + revision;
export function refresh() {
  revision++;
  notify();
}
export function usePathname() {
  return useSyncExternalStore(subscribe, () => route().pathname);
}
export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, () => route().search);
  return useMemo(() => new URLSearchParams(search), [search]);
}
const router = {
  push: (href) => navigate(href),
  replace: (href) => navigate(href, true),
  refresh,
  back: () => history.back(),
  forward: () => history.forward(),
  prefetch() {},
};
export const useRouter = () => router;
export class NavigationSignal extends Error {
  constructor(path) {
    super(path);
    this.path = path;
  }
}
export function redirect(path) {
  throw new NavigationSignal(path);
}
export function notFound() {
  throw new NavigationSignal("/not-found");
}
export const cookies = async () => ({
  get: (name) => (jar.has(name) ? { value: jar.get(name) } : undefined),
  set: (name, value) => jar.set(name, value),
  delete: (name) => jar.delete(name),
});
export const headers = async () =>
  new Headers({ "accept-language": jar.get("orion-locale") });
export const locale = () => jar.get("orion-locale");
export function demoLocale(value) {
  jar.set("orion-locale", value);
  document.documentElement.lang = value;
  refresh();
}
export function revalidatePath() {} // The real screen requests router.refresh after a successful command.
export default function Link({
  href,
  children,
  prefetch,
  replace,
  scroll,
  ...props
}) {
  void prefetch;
  void scroll;
  const value = typeof href === "string" ? href : href.pathname;
  return (
    <a
      {...props}
      href={"#" + value}
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented && !e.metaKey && !e.ctrlKey && e.button === 0) {
          e.preventDefault();
          navigate(value, replace);
        }
      }}
    >
      {children}
    </a>
  );
}
// The standalone document has no IdP or HTTP API. Only this explicit login link is simulated.
addEventListener("click", (event) => {
  const anchor = event.target.closest?.("a");
  if (anchor?.href === "https://orion.invalid/auth/login") {
    event.preventDefault();
    navigate("/");
  }
});
