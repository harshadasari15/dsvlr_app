import type { SheetData } from "@civil/tool-sdk";

/** Blank-but-illustrated input workbook (one sheet per section). */
export function boreholeTemplate(): SheetData[] {
  return [
    {
      name: "PROJECT_INFO",
      rows: [
        ["Parameter", "Value"],
        ["Project_Name", "Your project name"],
        ["Consultant", ""],
        ["Client", ""],
        ["Date", ""],
      ],
    },
    {
      name: "ALIGNMENT_DATA",
      rows: [
        ["Chainage", "Easting", "Northing", "Remarks"],
        [10000, 500000, 2500000, "Start"],
        [11000, 500950, 2500310, ""],
        [12000, 501900, 2500620, ""],
      ],
    },
    {
      name: "STRUCTURES_DATA",
      rows: [
        [
          "Structure_ID",
          "Structure_Type",
          "Structure_Name",
          "Chainage",
          "Span_Arrangement",
          "Skew_Angle_Deg",
          "Skew_Direction",
          "Width_LHS",
          "Width_RHS",
          "Crossing_Feature",
          "Ref_Chainage",
        ],
        ["STR-01", "VUP", "VUP @ CH:11.600", 11600, "15+30+15", 0, "NONE", 9.25, 9.25, "Underpass", 11600],
      ],
    },
    {
      name: "BOREHOLES_DATA",
      rows: [
        ["Structure_ID", "BH_No", "Member_Location", "Chainage", "Offset_m", "Side", "RL_m", "Depth_m", "Remarks"],
        ["STR-01", "BH1", "Abutment A1", 11570, 9.25, "LHS", 342.85, 25, ""],
        ["STR-01", "BH2", "Pier P1", 11585, 5, "RHS", 342.6, 25, ""],
      ],
    },
  ];
}
