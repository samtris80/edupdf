import React, { useState } from "react";

export default function App() {
  const [mode, setMode] = useState("prof");
  const [studentName, setStudentName] = useState("");

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>📄 EduPDF - Version Stable</h1>

      <button onClick={() => setMode("prof")}>👨‍🏫 Prof</button>
      <button onClick={() => setMode("eleve")}>👨‍🎓 Élève</button>

      {mode === "prof" && (
        <div style={{ marginTop: 20 }}>
          <h2>Mode Prof</h2>
          <p>✔️ Interface prête</p>
          <p>✔️ Tu peux maintenant ajouter tes modules progressivement</p>
        </div>
      )}

      {mode === "eleve" && (
        <div style={{ marginTop: 20 }}>
          <h2>Mode Élève</h2>
          <input
            placeholder="Nom élève"
            onChange={(e) => setStudentName(e.target.value)}
          />
          <p>Nom : {studentName}</p>
        </div>
      )}
    </div>
  );
}