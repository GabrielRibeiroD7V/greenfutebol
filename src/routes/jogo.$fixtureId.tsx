import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/jogo/$fixtureId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/jogo/$fixtureId"!</div>
}
