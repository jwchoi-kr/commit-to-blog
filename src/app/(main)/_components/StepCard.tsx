import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/_components/ui/card";

type Props = {
  step: number;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
};

export function StepCard({ step, title, description, children }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {step}. {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
