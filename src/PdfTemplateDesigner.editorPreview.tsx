import { createElement, ReactElement } from "react";
import "./ui/PdfTemplateDesigner.css";

export function preview(): ReactElement {
  return (
    <div className="pdf-template-designer pdf-template-designer--preview">
      <div className="pdf-template-designer__preview-card">
        <div className="pdf-template-designer__preview-title">
          PDF Template Designer
        </div>
        <div className="pdf-template-designer__preview-row" />
        <div className="pdf-template-designer__preview-row" />
        <div className="pdf-template-designer__preview-row pdf-template-designer__preview-row--short" />
      </div>
    </div>
  );
}
