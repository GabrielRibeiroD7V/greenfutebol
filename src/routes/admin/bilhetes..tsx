import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/bilhetes/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/bilhetes/"!</div>
}
