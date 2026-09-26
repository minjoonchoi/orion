import "../../src/app/globals.css";
import "../../src/components/ui/styles.css";
import React, { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import routes from "orion-demo-routes";
import ConsoleLayout from "../../src/app/(console)/layout";
import NotFound from "../../src/app/not-found";
import { I18nProvider } from "../../src/i18n/provider";
import {
  subscribe,
  route,
  routeVersion,
  locale,
  NavigationSignal,
  navigate,
} from "./runtime";
function App() {
  const version = useSyncExternalStore(subscribe, routeVersion);
  const language = useSyncExternalStore(subscribe, locale);
  const [view, setView] = useState(null);
  useEffect(() => {
    let active = true;
    async function load() {
      const current = route();
      const record = routes.find((item) => item.pattern.test(current.pathname));
      const match = record?.pattern.exec(current.pathname);
      const params = Object.fromEntries(
        (record?.keys ?? []).map((key, i) => [
          key,
          decodeURIComponent(match[i + 1]),
        ]),
      );
      try {
        const Page = record?.page ?? NotFound;
        const props = {
          params: Promise.resolve(params),
          searchParams: Promise.resolve(
            Object.fromEntries(current.searchParams),
          ),
        };
        const child = record?.client ? <Page {...props} /> : await Page(props);
        const next =
          current.pathname === "/login"
            ? child
            : await ConsoleLayout({ children: child });
        if (active) setView(next);
      } catch (error) {
        if (!active) return;
        if (error instanceof NavigationSignal) navigate(error.path, true);
        else {
          console.error(error);
          setView(
            <main>
              <h1>화면을 불러오지 못했습니다</h1>
              <p role="alert">{error.message}</p>
            </main>,
          );
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [version]);
  return (
    <I18nProvider
      locale={language}
      timeZone="Asia/Seoul"
      mode="demo"
      environment="test"
      region="local"
    >
      {view}
    </I18nProvider>
  );
}
createRoot(document.getElementById("root")).render(<App />);
