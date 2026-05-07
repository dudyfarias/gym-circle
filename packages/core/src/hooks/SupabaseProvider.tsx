import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  createGymCircleServices,
  type GymCircleClient,
  type GymCircleServices,
} from "../services";

const ServicesContext = createContext<GymCircleServices | null>(null);

type SupabaseProviderProps = {
  client: GymCircleClient;
  children: ReactNode;
};

export function SupabaseProvider({ client, children }: SupabaseProviderProps) {
  const services = useMemo(() => createGymCircleServices(client), [client]);
  return (
    <ServicesContext.Provider value={services}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useGymCircleServices(): GymCircleServices {
  const ctx = useContext(ServicesContext);
  if (!ctx) {
    throw new Error("useGymCircleServices precisa de <SupabaseProvider>.");
  }
  return ctx;
}

export function useGymCircleClient(): GymCircleClient {
  return useGymCircleServices().client;
}
