import Shell from "./components/Shell";
import { useCreditAwards } from "./lib/credits";
import { GridProvider } from "./lib/grid";
import { useRoute } from "./lib/router";
import Dashboard from "./pages/Dashboard";
import Insights from "./pages/Insights";
import MyHome from "./pages/MyHome";

export default function App() {
  const route = useRoute();
  useCreditAwards();
  return (
    <GridProvider>
      <Shell route={route}>
        {route === "/home" ? <MyHome /> : route === "/insights" ? <Insights /> : <Dashboard />}
      </Shell>
    </GridProvider>
  );
}
