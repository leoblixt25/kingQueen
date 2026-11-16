import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Wrench } from "lucide-react";
import {
  GSDE_ADMIN_SECTIONS,
  type GsdeAdminSection,
} from "@/formats/group-double-elimination";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";

const STATUS_LABEL: Record<GsdeAdminSection["availableFrom"][number], string> = {
  draft: "Setup",
  configured: "After groups",
  "group-stage": "Group stage",
  elimination: "Elimination",
  "grand-final": "Grand Final",
  completed: "Completed",
};

export default function GroupDoubleEliminationAdminSetup() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-light via-sand to-ocean-light/20 px-4 pt-8 pb-8 flex items-start justify-center">
      <div className="w-full max-w-2xl mx-auto animate-fade-in">
        <Link
          to={GROUP_DOUBLE_ELIMINATION_FORMAT.route}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ocean hover:text-ocean-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {GROUP_DOUBLE_ELIMINATION_FORMAT.shortName}
        </Link>

        <div className="mt-4 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ocean-gradient text-white shadow-sm">
            <Wrench className="h-6 w-6" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-foreground">
                Admin setup
              </h1>
              <Badge variant="secondary">Scaffolding only</Badge>
            </div>
            <p className="text-sm text-foreground/70">
              {GROUP_DOUBLE_ELIMINATION_FORMAT.name}
            </p>
          </div>
        </div>

        <Card className="mt-6 border-ocean/30 bg-ocean/5 shadow-sm">
          <CardContent className="p-4 text-sm text-foreground/75">
            The admin tools are laid out but not active yet. No tournament data
            is created, read or written from this page. Group and bracket
            engines arrive in a later phase.
          </CardContent>
        </Card>

        <div className="mt-6 space-y-3">
          {GSDE_ADMIN_SECTIONS.map((section, index) => (
            <Card
              key={section.id}
              className="border-sand-dark/40 shadow-beach bg-card/95"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    <span className="mr-2 text-ocean">{index + 1}.</span>
                    {section.title}
                  </CardTitle>
                  <Badge variant="outline">
                    {STATUS_LABEL[section.availableFrom[0]]}
                  </Badge>
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-foreground/60">
          <Link
            to="/"
            className="font-semibold text-foreground/80 hover:underline"
          >
            Back to all formats
          </Link>
        </div>
      </div>
    </div>
  );
}
