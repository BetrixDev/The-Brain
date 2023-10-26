import "./index.css";

import React, { useState } from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app";
import { ThemeProvider } from "./components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc } from "./lib/utils";
import { httpBatchLink } from "@trpc/client";
import { Toaster } from "./components/ui/toaster";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <>
    <Page />
    <Toaster />
  </>
);

function Page() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${window.location.protocol}//${window.location.hostname}:3000/trpc`,
        }),
      ],
    })
  );

  return (
    <React.StrictMode>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="dark">
            <App />
          </ThemeProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </React.StrictMode>
  );
}
