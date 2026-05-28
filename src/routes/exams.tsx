import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/exams')({
  component: ExamsLayout,
})

function ExamsLayout() {
  return <Outlet />
}
