import { Navigate } from "react-router-dom";

/** Legacy route; app entry is `/` (Landing). */
export default function Index() {
  return <Navigate to="/" replace />;
}
