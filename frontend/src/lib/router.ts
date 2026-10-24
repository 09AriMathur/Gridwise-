import { useEffect, useState } from "react";

export type Route = "/" | "/home" | "/insights";
const ROUTES: Route[] = ["/", "/home", "/insights"];

function current(): Route {
  const h = window.location.hash.replace(/^#/, "") || "/";
  return (ROUTES as string[]).includes(h) ? (h as Route) : "/";
}

// Tiny hash router: #/ (dashboard), #/home, #/insights. No extra dependency.
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(current);
  useEffect(() => {
    const onChange = () => { setRoute(current()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
