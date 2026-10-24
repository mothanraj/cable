import { Navigate } from "react-router-dom";

/** Legacy /login → collector login (no chooser). */
export default function Login() {
  return (
    <Navigate
      to="/user/login"
      replace
    />
  );
}
