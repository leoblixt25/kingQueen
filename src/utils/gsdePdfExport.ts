import jsPDF from "jspdf";
import type { GsdeTournamentDocument } from "@/formats/group-double-elimination/persistence";
import {
  buildGsdeTournamentReport,
  type GsdeReportMatch,
  type GsdeTournamentReport,
} from "@/formats/group-double-elimination/report";

/**
 * GSDE PDF export in the same visual family as the King & Queen export:
 * A4 millimetres, dark-blue header band, orange/blue divisions, white rounded
 * cards and a gold final panel. All content comes from the isolated GSDE
 * document via the pure report builder — no K&Q collections are read.
 */

type RGB = [number, number, number];

const BLUE: RGB = [0, 119, 182];
const ORANGE: RGB = [255, 127, 80];
const HEADER_BG: RGB = [0, 86, 130];
const WHITE: RGB = [255, 255, 255];
const LIGHT_BLUE: RGB = [224, 247, 255];
const LIGHT_ORANGE: RGB = [255, 243, 224];
const STRIP_BLUE: RGB = [232, 240, 248];
const STRIP_TEXT: RGB = [0, 70, 110];
const ROW_GRAY: RGB = [250, 250, 250];
const BORDER_GRAY: RGB = [210, 218, 226];
const FOOTER_GRAY: RGB = [160, 160, 160];
const GOLD: RGB = [176, 141, 30];
const GOLD_LIGHT: RGB = [255, 246, 220];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 11;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PAGE_BOTTOM = 283;

interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
}

interface MatchSection {
  title: string;
  matches: GsdeReportMatch[];
}

const fitFontSize = (
  pdf: jsPDF,
  text: string,
  maxWidth: number,
  base: number,
  min: number
): number => {
  let size = base;
  pdf.setFontSize(size);
  while (pdf.getTextWidth(text) > maxWidth && size > min) {
    size -= 0.5;
    pdf.setFontSize(size);
  }
  return size;
};

const formatDate = (value: string): string => {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    );
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const datePart = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 10);
};

const sanitize = (value: string): string =>
  value.replace(/[^A-Za-z0-9]+/g, "").slice(0, 48) || "Tournament";

/** Render a report model into an in-memory PDF (also useful for smoke tests). */
export const buildGsdePdf = (report: GsdeTournamentReport): jsPDF => {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const prettyDate = formatDate(report.date);

    const drawPageHeader = (): void => {
      pdf.setFillColor(...HEADER_BG);
      pdf.rect(0, 0, PAGE_W, 30, "F");
      pdf.setTextColor(...WHITE);
      pdf.setFont(undefined, "bold");
      const titleSize = fitFontSize(pdf, report.title, 180, 18, 11);
      pdf.setFontSize(titleSize);
      pdf.text(report.title, 105, 11, { align: "center" });
      pdf.setFontSize(10);
      pdf.setFont(undefined, "normal");
      pdf.text("Group Stage + Double Elimination", 105, 18, { align: "center" });
      pdf.setFontSize(8);
      const subtitle = [
        report.category,
        report.division,
        prettyDate,
      ]
        .filter(Boolean)
        .join(" | ");
      pdf.text(subtitle, 105, 25, { align: "center" });
    };

    const addPage = (): number => {
      pdf.addPage();
      drawPageHeader();
      return 38;
    };

    const drawSectionTitle = (
      title: string,
      y: number,
      accent: RGB = HEADER_BG
    ): number => {
      pdf.setFont(undefined, "bold");
      const size = fitFontSize(pdf, title, CONTENT_W, 14, 10);
      pdf.setFontSize(size);
      pdf.setTextColor(...accent);
      pdf.text(title, 105, y, { align: "center" });
      pdf.setDrawColor(...accent);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
      return y + 9;
    };

    const drawTable = (
      title: string,
      columns: TableColumn[],
      rows: string[][],
      startY: number,
      accent: RGB = HEADER_BG,
      rowHeight = 6.2
    ): number => {
      let y = drawSectionTitle(title, startY, accent);
      const tableW = columns.reduce((sum, column) => sum + column.width, 0);

      const drawHeader = (headerY: number): number => {
        pdf.setFillColor(...(accent === GOLD ? GOLD_LIGHT : STRIP_BLUE));
        pdf.roundedRect(MARGIN, headerY - 4, tableW, 7, 1.5, 1.5, "F");
        pdf.setFont(undefined, "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(...(accent === GOLD ? GOLD : STRIP_TEXT));
        let x = MARGIN + 3;
        columns.forEach((column) => {
          const align = column.align ?? "left";
          const textX =
            align === "right"
              ? x + column.width - 6
              : align === "center"
                ? x + column.width / 2 - 3
                : x;
          pdf.text(column.header, textX, headerY + 0.8);
          x += column.width;
        });
        return headerY + 5;
      };

      let bodyY = drawHeader(y);
      rows.forEach((row, rowIndex) => {
        if (bodyY + rowHeight > PAGE_BOTTOM) {
          y = addPage();
          y = drawSectionTitle(`${title} (continued)`, y, accent);
          bodyY = drawHeader(y);
        }
        if (rowIndex % 2 === 0) {
          pdf.setFillColor(...ROW_GRAY);
          pdf.rect(MARGIN, bodyY - 4, tableW, rowHeight, "F");
        }
        let x = MARGIN + 3;
        columns.forEach((column, index) => {
          const value = row[index] ?? "";
          const align = column.align ?? "left";
          const maxWidth = column.width - 6;
          const size = fitFontSize(pdf, value, maxWidth, 8.5, 6.5);
          pdf.setFontSize(size);
          pdf.setFont(undefined, index === 0 && title.includes("Ranking") ? "bold" : "normal");
          pdf.setTextColor(35, 35, 35);
          const textX =
            align === "right"
              ? x + column.width - 6
              : align === "center"
                ? x + column.width / 2
                : x;
          pdf.text(value, textX, bodyY, { align });
          x += column.width;
        });
        bodyY += rowHeight;
      });
      return bodyY + 4;
    };

    const drawMatchCard = (
      match: GsdeReportMatch,
      x: number,
      y: number,
      w: number,
      h: number,
      accent: RGB
    ): void => {
      const completed = match.status === "completed" && match.scoreA !== null && match.scoreB !== null;
      const label = `${match.groupName ? `${match.groupName} · ` : ""}${match.label}`;

      pdf.setFillColor(...WHITE);
      pdf.setDrawColor(...BORDER_GRAY);
      pdf.setLineWidth(0.25);
      pdf.roundedRect(x, y, w, h, 2.5, 2.5, "FD");

      const labelH = 6;
      pdf.setFillColor(...STRIP_BLUE);
      pdf.roundedRect(x, y, w, labelH, 2.5, 2.5, "F");
      pdf.rect(x, y + 2, w, labelH - 2, "F");
      pdf.setFontSize(8);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(...STRIP_TEXT);
      pdf.setFontSize(fitFontSize(pdf, label, w - 8, 8, 6.5));
      pdf.text(label, x + 4, y + 4.2);

      const pad = 2.5;
      const barX = x + pad;
      const barW = w - pad * 2;
      const inner = h - labelH - 2;
      const barH = (inner - 5) / 2;
      const barY1 = y + labelH + 1;
      const vsY = barY1 + barH;
      const barY2 = vsY + 5;
      const scoreReserve = completed ? 11 : 0;
      const nameMaxW = barW - scoreReserve - 6;

      pdf.setFillColor(...BLUE);
      pdf.roundedRect(barX, barY1, barW, barH, 1.5, 1.5, "F");
      pdf.setTextColor(...WHITE);
      pdf.setFont(undefined, "bold");
      const fsA = fitFontSize(pdf, match.teamA, nameMaxW, 9, 6.5);
      pdf.setFontSize(fsA);
      pdf.text(match.teamA, barX + 3.5, barY1 + barH / 2 + fsA * 0.185);
      if (completed) {
        pdf.setFontSize(10);
        pdf.text(String(match.scoreA), barX + barW - 2.5, barY1 + barH / 2 + 3.5, { align: "right" });
      }

      pdf.setFontSize(7.5);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(...accent);
      pdf.text("VS", x + w / 2, vsY + 3.5, { align: "center" });

      pdf.setFillColor(...ORANGE);
      pdf.roundedRect(barX, barY2, barW, barH, 1.5, 1.5, "F");
      pdf.setTextColor(...WHITE);
      pdf.setFont(undefined, "bold");
      const fsB = fitFontSize(pdf, match.teamB, nameMaxW, 9, 6.5);
      pdf.setFontSize(fsB);
      pdf.text(match.teamB, barX + 3.5, barY2 + barH / 2 + fsB * 0.185);
      if (completed) {
        pdf.setFontSize(10);
        pdf.text(String(match.scoreB), barX + barW - 2.5, barY2 + barH / 2 + 3.5, { align: "right" });
      }
    };

    const drawMatchSections = (
      sections: MatchSection[],
      startY: number,
      accent: RGB
    ): number => {
      let y = startY;
      const cardW = 88;
      const cardH = 30;
      const rowGap = 4;
      const col2 = MARGIN + cardW + 10;

      sections.forEach((section) => {
        if (section.matches.length === 0) return;
        if (y + 18 > PAGE_BOTTOM) y = addPage();
        y = drawSectionTitle(section.title, y, accent) + 2;
        section.matches.forEach((match, index) => {
          const isLeft = index % 2 === 0;
          if (y + cardH > PAGE_BOTTOM) {
            y = addPage();
            y = drawSectionTitle(`${section.title} (continued)`, y, accent) + 2;
          }
          drawMatchCard(match, isLeft ? MARGIN : col2, y, cardW, cardH, accent);
          if (isLeft) y += cardH + rowGap;
        });
        if (y > PAGE_BOTTOM) y = addPage();
      });
      return y;
    };

    const drawPlayerRoster = (startY: number): number => {
      const female = report.players.filter((player) => player.gender === "female");
      const male = report.players.filter((player) => player.gender === "male");
      const other = report.players.filter((player) => player.gender === null);
      const twoColumns = female.length > 0 && male.length > 0;
      const columns: Array<{
        label: string;
        players: typeof report.players;
        x: number;
        w: number;
        bg: RGB;
        fg: RGB;
      }> = twoColumns
        ? [
            { label: "FEMALE PLAYERS", players: female, x: MARGIN, w: 88, bg: LIGHT_ORANGE, fg: ORANGE },
            { label: "MALE PLAYERS", players: male, x: MARGIN + 98, w: 88, bg: LIGHT_BLUE, fg: BLUE },
          ]
        : [
            {
              label:
                report.category === "Male"
                  ? "MALE PLAYERS"
                  : report.category === "Female"
                    ? "FEMALE PLAYERS"
                    : "REGISTERED PLAYERS",
              players: [...female, ...male, ...other],
              x: MARGIN,
              w: CONTENT_W,
              bg: LIGHT_BLUE,
              fg: BLUE,
            },
          ];

      let y = drawSectionTitle("Registered Players", startY);
      const rowH = 5.6;
      const bottoms = columns.map((column) => {
        let cy = y;
        pdf.setFillColor(...column.bg);
        pdf.roundedRect(column.x, cy - 4, column.w, 7, 2, 2, "F");
        pdf.setFontSize(10);
        pdf.setFont(undefined, "bold");
        pdf.setTextColor(...column.fg);
        pdf.text(`${column.label} (${column.players.length})`, column.x + 4, cy + 0.5);
        cy += 8;

        column.players.forEach((player, index) => {
          if (cy + rowH > PAGE_BOTTOM) {
            cy = addPage();
            y = drawSectionTitle("Registered Players (continued)", cy);
            cy = y + 1;
          }
          if (index % 2 === 0) {
            pdf.setFillColor(...ROW_GRAY);
            pdf.rect(column.x, cy - 4, column.w, rowH, "F");
          }
          const label = `${index + 1}. ${player.name}`;
          pdf.setFontSize(9);
          pdf.setFont(undefined, "normal");
          pdf.setTextColor(0, 0, 0);
          pdf.text(label, column.x + 4, cy, {
            maxWidth: column.w - 8,
          });
          cy += rowH;
        });
        return cy;
      });

      if (twoColumns && bottoms.length === 2) {
        pdf.setDrawColor(...BORDER_GRAY);
        pdf.setLineWidth(0.3);
        pdf.line(MARGIN + 93, y - 4, MARGIN + 93, Math.max(...bottoms));
      }
      return Math.max(...bottoms, y) + 4;
    };

    const drawChampionPanel = (startY: number): number => {
      const cardW = 90;
      const cardH = 42;
      const col2 = MARGIN + cardW + 8;
      const y = startY + 2;
      const cards = [
        { x: MARGIN, label: "CHAMPION", name: report.champions.join(" / ") || "TBD", isWinner: true },
        { x: col2, label: "RUNNER-UP", name: report.runnersUp.join(" / ") || "TBD", isWinner: false },
      ];

      cards.forEach((card) => {
        pdf.setFillColor(...WHITE);
        pdf.setDrawColor(...(card.isWinner ? GOLD : BORDER_GRAY));
        pdf.setLineWidth(card.isWinner ? 0.8 : 0.25);
        pdf.roundedRect(card.x, y, cardW, cardH, 2.5, 2.5, "FD");

        const labelH = 7;
        pdf.setFillColor(...(card.isWinner ? GOLD_LIGHT : STRIP_BLUE));
        pdf.roundedRect(card.x, y, cardW, labelH, 2.5, 2.5, "F");
        pdf.rect(card.x, y + 3, cardW, labelH - 3, "F");
        pdf.setFontSize(9);
        pdf.setFont(undefined, "bold");
        pdf.setTextColor(...(card.isWinner ? GOLD : STRIP_TEXT));
        pdf.text(card.label, card.x + 4, y + 4.8);

        pdf.setTextColor(0, 0, 0);
        const fs = fitFontSize(pdf, card.name, cardW - 10, 12, 7);
        pdf.setFontSize(fs);
        pdf.setFont(undefined, "bold");
        pdf.text(card.name, card.x + cardW / 2, y + 24, { align: "center" });

        pdf.setFontSize(8);
        pdf.setFont(undefined, "normal");
        pdf.setTextColor(110, 110, 110);
        const note = card.isWinner
          ? report.resetFinalRequired
            ? "Won after the reset final"
            : "Tournament winner"
          : "Second place";
        pdf.text(note, card.x + cardW / 2, y + cardH - 7, { align: "center" });
      });

      let panelY = y + cardH + 8;
      if (panelY + 30 > PAGE_BOTTOM) panelY = addPage();
      pdf.setFillColor(252, 248, 235);
      pdf.setDrawColor(...GOLD);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(MARGIN, panelY, CONTENT_W, 28, 2.5, 2.5, "FD");
      pdf.setFontSize(9);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(...GOLD);
      pdf.text("FINAL RESULT", 105, panelY + 6, { align: "center" });
      pdf.setFontSize(10);
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(40, 40, 40);
      pdf.text(`Champion: ${report.champions.join(" / ") || "TBD"}`, MARGIN + 8, panelY + 15);
      pdf.text(`Runner-up: ${report.runnersUp.join(" / ") || "TBD"}`, MARGIN + 8, panelY + 23);
      return panelY + 32;
    };

    // Page 1 — overview and registered players.
    drawPageHeader();
    let y = drawSectionTitle("Tournament Overview", 38);
    const infoRows = [
      ["Tournament", report.title],
      ["Division", report.division],
      ["Category", report.category],
      ["Date", prettyDate || "Not set"],
      ["Status", report.status],
      ["Teams / Players", `${report.counts.teams} / ${report.counts.players}`],
      ["Groups", String(report.counts.groups)],
      [
        "Progress",
        `${report.counts.groupMatchesCompleted}/${report.counts.groupMatchesTotal} group · ${report.counts.eliminationMatchesCompleted}/${report.counts.eliminationMatchesTotal} elimination`,
      ],
    ];
    infoRows.forEach((row, index) => {
      if (index % 2 === 0) {
        pdf.setFillColor(...ROW_GRAY);
        pdf.rect(MARGIN, y - 4, CONTENT_W, 6.4, "F");
      }
      pdf.setFontSize(9);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(...HEADER_BG);
      pdf.text(row[0], MARGIN + 4, y);
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(35, 35, 35);
      pdf.text(row[1], MARGIN + 48, y, { maxWidth: CONTENT_W - 52 });
      y += 6.4;
    });
    y += 6;
    if (report.players.length > 0) y = drawPlayerRoster(y);

    // Teams and group allocation.
    y = addPage();
    y = drawTable(
      "Teams & Groups",
      [
        { header: "#", width: 12, align: "center" },
        { header: "Team", width: 78 },
        { header: "Players", width: 58 },
        { header: "Group", width: 26, align: "center" },
        { header: "Seed", width: 14, align: "center" },
      ],
      report.teams.map((team, index) => [
        String(index + 1),
        team.name,
        team.players.join(" / "),
        team.groupName,
        team.seed === null ? "-" : String(team.seed),
      ]),
      y
    );

    // Group standings and group-stage results.
    if (report.groups.length > 0) {
      y = addPage();
      report.groups.forEach((group) => {
        y = drawTable(
          `${group.name} — Standings`,
          [
            { header: "#", width: 12, align: "center" },
            { header: "Team", width: 80 },
            { header: "P", width: 14, align: "center" },
            { header: "W", width: 14, align: "center" },
            { header: "L", width: 14, align: "center" },
            { header: "+/-", width: 20, align: "right" },
            { header: "PF", width: 16, align: "right" },
            { header: "PA", width: 16, align: "right" },
          ],
          group.standings.map((row) => [
            String(row.rank),
            row.team,
            String(row.played),
            String(row.wins),
            String(row.losses),
            row.pointDifference > 0 ? `+${row.pointDifference}` : String(row.pointDifference),
            String(row.pointsFor ?? 0),
            String(row.pointsAgainst ?? 0),
          ]),
          y,
          BLUE
        );
      });

      y = addPage();
      drawMatchSections(
        report.groups.map((group) => ({
          title: `${group.name} — Results`,
          matches: group.results,
        })),
        y,
        BLUE
      );
    }

    // Global group ranking used to seed the bracket.
    if (report.globalRanking.length > 0) {
      y = addPage();
      y = drawTable(
        "Global Group Ranking",
        [
          { header: "Seed", width: 16, align: "center" },
          { header: "Team", width: 88 },
          { header: "Group", width: 30, align: "center" },
          { header: "W", width: 14, align: "center" },
          { header: "L", width: 14, align: "center" },
          { header: "+/-", width: 26, align: "right" },
        ],
        report.globalRanking.map((row) => [
          String(row.rank),
          row.team,
          row.group,
          String(row.wins),
          String(row.losses),
          row.pointDifference > 0 ? `+${row.pointDifference}` : String(row.pointDifference),
        ]),
        y,
        ORANGE
      );
    }

    // Elimination bracket results.
    if (report.eliminationMatches.length > 0 || report.eliminationStandings.length > 0) {
      if (report.eliminationMatches.length > 0) {
        y = addPage();
        const phaseSections: MatchSection[] = [
          {
            title: "Winners Bracket",
            matches: report.eliminationMatches.filter((match) => match.phase === "winners"),
          },
          {
            title: "Losers Bracket",
            matches: report.eliminationMatches.filter((match) => match.phase === "losers"),
          },
          {
            title: "Grand Final",
            matches: report.eliminationMatches.filter((match) => match.phase === "grand-final"),
          },
        ];
        // Fall back to stored bracket order when ids do not follow the w/l/gf prefix.
        const phaseMatched = phaseSections.reduce((sum, section) => sum + section.matches.length, 0);
        const orderedSections: MatchSection[] =
          phaseMatched === report.eliminationMatches.length
            ? phaseSections
            : [
                {
                  title: "Elimination Results",
                  matches: report.eliminationMatches,
                },
              ];
        drawMatchSections(orderedSections, y, ORANGE);
      }

      if (report.eliminationStandings.length > 0) {
        y = addPage();
        y = drawTable(
          "Elimination Status",
          [
            { header: "Team", width: 92 },
            { header: "W", width: 18, align: "center" },
            { header: "L", width: 18, align: "center" },
            { header: "Status", width: 42, align: "right" },
            { header: "Place", width: 18, align: "right" },
          ],
          report.eliminationStandings.map((row) => [
            row.team,
            String(row.wins),
            String(row.losses),
            row.status,
            row.rank === null ? "-" : String(row.rank),
          ]),
          y,
          ORANGE
        );
      }

      if (report.finalPlacements.length > 0) {
        y = addPage();
        y = drawTable(
          "Final Placements",
          [
            { header: "Place", width: 20, align: "center" },
            { header: "Team(s)", width: 168 },
          ],
          report.finalPlacements.map((placement) => [
            String(placement.place),
            placement.teams.join(" / "),
          ]),
          y,
          GOLD
        );
        if (report.complete) y = drawChampionPanel(y);
      }
    }

    // Corrections are kept in the export so the result trail is auditable.
    if (report.corrections.length > 0) {
      y = addPage();
      drawTable(
        "Corrections & Admin Actions",
        [
          { header: "When", width: 38 },
          { header: "Action", width: 42 },
          { header: "Actor", width: 50 },
          { header: "Detail", width: 58 },
        ],
        report.corrections.map((entry) => [
          entry.at.replace("T", " ").slice(0, 16),
          entry.action,
          entry.actor,
          entry.detail || entry.matchId || "-",
        ]),
        y
      );
    }

    const totalPages = pdf.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      pdf.setPage(page);
      pdf.setFontSize(7);
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(...FOOTER_GRAY);
      pdf.text(
        `Generated ${new Date().toLocaleDateString()} | Page ${page} of ${totalPages}`,
        105,
        292,
        { align: "center" }
      );
    }

  return pdf;
};

export const exportGsdeTournamentPdf = async (
  tournament: GsdeTournamentDocument
): Promise<void> => {
  const report = buildGsdeTournamentReport(tournament);
  const hasData =
    report.teams.length > 0 ||
    report.players.length > 0 ||
    report.groups.length > 0 ||
    report.groups.some((group) => group.results.length > 0) ||
    report.eliminationMatches.length > 0;

  if (!hasData) {
    alert("No GSDE tournament data available to export.");
    return;
  }

  try {
    const pdf = buildGsdePdf(report);
    pdf.save(
      `GSDE-${sanitize(report.title)}-${datePart(report.date || report.generatedAt)}.pdf`
    );
  } catch (error) {
    console.error("GSDE PDF export error:", error);
    alert(
      `Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
