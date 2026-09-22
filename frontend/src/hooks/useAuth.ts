import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import type { AuthContextType } from "@lavanderia/shared/types/types";

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
};
