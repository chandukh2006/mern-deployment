import { Outlet } from "react-router-dom";
import Navbar from "./components/Navbar";

const App = () => {
  return (
    <div className="w-full p-6">
      <h1 className="text-3xl font-bold text-center text-blue-600 mb-6">
         Jenkins CI/CD Working Successfully now issues resolved
      </h1>

      <Navbar />
      <Outlet />
    </div>
  );
};

export default App;