diff --git a/src/routes/_app/exams/new/index.tsx b/src/routes/_app/exams/new/index.tsx
index 71f7eac..6f6fd2a 100644
--- a/src/routes/_app/exams/new/index.tsx
+++ b/src/routes/_app/exams/new/index.tsx
@@ -1,4 +1,13 @@
 import { createFileRoute } from "@tanstack/react-router";
+import {
+	Card,
+	CardContent,
+	CardDescription,
+	CardHeader,
+	CardTitle,
+} from "@/components/ui/card";
+import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
+import { GenerateExamForm } from "@/features/exams/components/generate-exam-form";
 import { IngestUploadForm } from "@/features/exams/components/ingest-upload-form";
 
 export const Route = createFileRoute("/_app/exams/new/")({
@@ -9,11 +18,48 @@ function ExamsNewPage() {
 	return (
 		<div className="flex flex-col gap-6">
 			<div className="flex flex-col gap-1">
+				<h1 className="text-xl font-semibold">Nova prova</h1>
 				<p className="text-sm text-muted-foreground">
-					Envie um arquivo .txt ou .md para extrair questões via IA.
+					Escolha entre importar um arquivo existente ou gerar uma prova nova
+					com IA a partir do conteudo que voce fornecer.
 				</p>
 			</div>
-			<IngestUploadForm />
+
+			<Tabs defaultValue="import" className="gap-4">
+				<TabsList className="w-full sm:w-fit">
+					<TabsTrigger value="import">Importar arquivo</TabsTrigger>
+					<TabsTrigger value="generate">Gerar com IA</TabsTrigger>
+				</TabsList>
+
+				<TabsContent value="import">
+					<Card>
+						<CardHeader>
+							<CardTitle>Importar arquivo</CardTitle>
+							<CardDescription>
+								Envie um arquivo .txt ou .md para extrair questoes via IA.
+							</CardDescription>
+						</CardHeader>
+						<CardContent>
+							<IngestUploadForm />
+						</CardContent>
+					</Card>
+				</TabsContent>
+
+				<TabsContent value="generate">
+					<Card>
+						<CardHeader>
+							<CardTitle>Gerar com IA</CardTitle>
+							<CardDescription>
+								Descreva o conteudo base da prova, ajuste a dificuldade e anexe
+								contextos opcionais para iniciar um job no monitor padrao.
+							</CardDescription>
+						</CardHeader>
+						<CardContent>
+							<GenerateExamForm />
+						</CardContent>
+					</Card>
+				</TabsContent>
+			</Tabs>
 		</div>
 	);
 }
