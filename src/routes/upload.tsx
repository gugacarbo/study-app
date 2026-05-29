import { createFileRoute } from '@tanstack/react-router'
import { UploadForm } from '../components/upload-form'

export const Route = createFileRoute('/upload')({
  component: UploadPage,
})

function UploadPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Upload Exam</h1>
      <UploadForm />
    </div>
  )
}
