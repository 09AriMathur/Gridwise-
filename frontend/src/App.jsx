import { useState } from "react";

import TaskForm from "./components/TaskForm";
import Recommendation from "./components/Recommendation";
import DeviceSimulator from "./components/DeviceSimulator";

export default function App() {
  const [recommendation, setRecommendation] = useState(null);

  return (
    <main>
      <h1>GridWise</h1>
      <p>Find the cleanest time to run a power-hungry task.</p>

      <TaskForm onResult={setRecommendation} />
      <Recommendation data={recommendation} />
      <DeviceSimulator />
    </main>
  );
}
