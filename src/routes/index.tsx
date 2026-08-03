import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Futebol" },
      { name: "description", content: "Uma tela simples com a palavra Futebol." },
      { property: "og:title", content: "Futebol" },
      { property: "og:description", content: "Uma tela simples com a palavra Futebol." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-5xl font-semibold tracking-tight text-foreground">Futebol</h1>
    </main>
  );
}
