import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DesignerChat } from "@/_components/designer-chat";

export default function DesignerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Designer Agent</h1>
        <p className="text-sm text-muted-foreground">
          AI-powered UI generation — describe what you need, get Next.js + Tailwind + shadcn/ui code
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Chat with Designer</CardTitle>
          </CardHeader>
          <CardContent>
            <DesignerChat />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
