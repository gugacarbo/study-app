import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const Route = createFileRoute('/exams')({
  component: ExamsLayout,
})

function ExamsLayout() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const tabValue = pathname === '/exams/stats' ? '/exams/stats' : '/exams'

  return (
    <Tabs value={tabValue} onValueChange={(value) => navigate({ to: value })}>
      <TabsList>
        <TabsTrigger value="/exams">Exams</TabsTrigger>
        <TabsTrigger value="/exams/stats">Stats</TabsTrigger>
      </TabsList>
      <div className="mt-6">
        <Outlet />
      </div>
    </Tabs>
  )
}
