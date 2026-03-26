import React, { useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// --- CONFIGURATION SUPABASE ---
const supabase = createClient(
  "https://wuaxlrbmlnqwxiowgveu.supabase.co", // remplace par ton URL Supabase
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1YXhscmJtbG5xd3hpb3dndmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MDIwOTcsImV4cCI6MjA5MDA3ODA5N30.0AFzUJ_1CFvqwY_EOqNmkwrNmX-dIsrSxKKJogYY1jc"     // remplace par ta ANON KEY
);

// --- MOT DE PASSE PROF ---
const PROF_PASSWORD = "prof2026"; // change à ton goût

export default function App() {
  const [mode, setMode] = useState("prof");
  const [profPassword, setProfPassword] = useState("");
  const [authOk, setAuthOk] = useState(false);

  const [pdf, setPdf] = useState(null);
  const [zones, setZones] = useState([]);
  const [answers, setAnswers] = useState({});
  const [exerciseId, setExerciseId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [responses, setResponses] = useState([]);

  const containerRef = useRef(null);

  // --- Charger exercice depuis lien élève ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      setMode("eleve");
      loadExercise(id);
    }
  }, []);

  const checkPassword = () => {
    if (profPassword === PROF_PASSWORD) setAuthOk(true);
    else alert("Mot de passe incorrect !");
  };

  const uploadPdf = (e) => {
    const file = e.target.files[0];
    if (file) setPdf(URL.createObjectURL(file));
  };

  const addZone = (e) => {
    if (mode !== "prof") return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setZones([
      ...zones,
      {
        id: Date.now(),
        x,
        y,
        width: 180,
        height: 100,
        type: "qcm",
        text: "Question",
        points: 2,
        options: ["A", "B"],
        correct: [],
        correctText: ""
      }
    ]);
  };

  const updateZone = (id, data) => {
    setZones(zones.map((z) => (z.id === id ? { ...z, ...data } : z)));
  };

  // --- Sauvegarde exercice + génération lien élève ---
  const saveExercise = async () => {
    const { data } = await supabase
      .from("exercises")
      .insert([{ data: { zones, pdf } }])
      .select()
      .single();

    setExerciseId(data.id);
    alert("Lien élève : " + window.location.origin + "?id=" + data.id);
  };

  const loadExercise = async (id) => {
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", id)
      .single();
    if (data) {
      setZones(data.data.zones);
      setPdf(data.data.pdf);
      setExerciseId(id);
    }
  };

  // --- Charger réponses des élèves pour dashboard ---
  const loadResponses = async () => {
    if (!exerciseId) return;
    const { data } = await supabase
      .from("responses")
      .select("*")
      .eq("exercise_id", exerciseId);
    setResponses(data || []);
  };

  // --- Correction avec demi-points ---
  const evaluate = async () => {
    let score = 0;
    let total = 0;

    zones.forEach((z) => {
      total += z.points;
      const ans = answers[z.id];

      if (z.type === "qcm") {
        const correctSet = new Set(z.correct);
        const studentSet = new Set(ans || []);
        let good = 0;
        let wrong = 0;
        studentSet.forEach((a) => {
          if (correctSet.has(a)) good++;
          else wrong++;
        });
        let partial = Math.max(0, good - wrong);
        score += (partial / correctSet.size) * z.points;
      }

      if (z.type === "text") {
        if (ans && ans.toLowerCase().trim() === z.correctText.toLowerCase().trim()) {
          score += z.points;
        }
      }
    });

    alert(`Score : ${score.toFixed(2)} / ${total}`);

    // --- Sauvegarde réponse élève ---
    await supabase.from("responses").insert([
      {
        exercise_id: exerciseId,
        student_name: studentName,
        answers,
        score
      }
    ]);
  };

  // --- Export Excel ---
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Nom élève", "Score", "Réponses"],
      ...responses.map((r) => [r.student_name, r.score, JSON.stringify(r.answers)])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Résultats");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "Résultats.xlsx");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>📄 EduPDF SaaS - Dashboard Prof / Élève</h1>

      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setMode("prof")}>👨‍🏫 Mode Prof</button>
        <button onClick={() => setMode("eleve")}>👨‍🎓 Mode Élève</button>
      </div>

      {/* --- Auth Prof --- */}
      {mode === "prof" && !authOk && (
        <div>
          <input
            type="password"
            placeholder="Mot de passe Prof"
            value={profPassword}
            onChange={(e) => setProfPassword(e.target.value)}
          />
          <button onClick={checkPassword}>Connexion</button>
        </div>
      )}

      {/* --- Interface Prof après auth --- */}
      {mode === "prof" && authOk && (
        <>
          <input type="file" onChange={uploadPdf} />
          <button onClick={saveExercise}>💾 Sauvegarder / Générer lien élève</button>
          <button onClick={loadResponses}>📥 Charger réponses élèves</button>

          <table border="1" style={{ marginTop: 20 }}>
            <thead>
              <tr>
                <th>Nom élève</th>
                <th>Score</th>
                <th>Réponses</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => (
                <tr key={r.id}>
                  <td>{r.student_name}</td>
                  <td>{r.score}</td>
                  <td>{JSON.stringify(r.answers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {responses.length > 0 && (
            <button onClick={exportExcel}>📥 Export Excel</button>
          )}
        </>
      )}

      {/* --- Interface Élève --- */}
      {mode === "eleve" && (
        <>
          <input
            placeholder="Nom élève"
            onChange={(e) => setStudentName(e.target.value)}
          />
        </>
      )}

      {/* --- PDF + zones --- */}
      {pdf && (
        <div
          ref={containerRef}
          style={{
            position: "relative",
            width: "100%",
            height: "600px",
            border: "1px solid gray",
          }}
        >
          <iframe
            src={pdf}
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              zIndex: 1,
            }}
          />

          <div
            onClick={addZone}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              zIndex: 2,
              cursor: mode === "prof" ? "crosshair" : "default",
            }}
          />

          {zones.map((z) => (
            <Rnd
              key={z.id}
              size={{ width: z.width, height: z.height }}
              position={{ x: z.x, y: z.y }}
              disableDragging={mode === "eleve"}
              enableResizing={mode === "prof"}
              onDragStop={(e, d) => updateZone(z.id, { x: d.x, y: d.y })}
              onResizeStop={(e, dir, ref, delta, pos) =>
                updateZone(z.id, {
                  width: parseInt(ref.style.width),
                  height: parseInt(ref.style.height),
                  ...pos,
                })
              }
              style={{ background: "white", padding: 5, zIndex: 3 }}
            >
              <select
                value={z.type}
                onChange={(e) => updateZone(z.id, { type: e.target.value })}
              >
                <option value="qcm">QCM</option>
                <option value="text">Texte</option>
              </select>

              <input
                value={z.text}
                onChange={(e) => updateZone(z.id, { text: e.target.value })}
              />

              {mode === "prof" && (
                <input
                  type="number"
                  value={z.points}
                  onChange={(e) =>
                    updateZone(z.id, { points: parseFloat(e.target.value) })
                  }
                />
              )}

              {/* QCM */}
              {z.type === "qcm" && (
                <>
                  {mode === "prof" &&
                    z.options.map((opt, i) => (
                      <div key={i}>
                        <input
                          value={opt}
                          onChange={(e) => {
                            const opts = [...z.options];
                            opts[i] = e.target.value;
                            updateZone(z.id, { options: opts });
                          }}
                        />
                        <input
                          type="checkbox"
                          checked={z.correct.includes(i)}
                          onChange={(e) => {
                            let correct = [...z.correct];
                            if (e.target.checked) correct.push(i);
                            else correct = correct.filter((c) => c !== i);
                            updateZone(z.id, { correct });
                          }}
                        />
                      </div>
                    ))}

                  {mode === "eleve" &&
                    z.options.map((opt, i) => (
                      <label key={i}>
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            let current = answers[z.id] || [];
                            if (e.target.checked) current.push(i);
                            else current = current.filter((c) => c !== i);
                            setAnswers({ ...answers, [z.id]: current });
                          }}
                        />
                        {opt}
                      </label>
                    ))}
                </>
              )}

              {/* TEXTE */}
              {z.type === "text" && (
                <>
                  {mode === "prof" && (
                    <input
                      placeholder="Bonne réponse"
                      value={z.correctText}
                      onChange={(e) =>
                        updateZone(z.id, { correctText: e.target.value })
                      }
                    />
                  )}

                  {mode === "eleve" && (
                    <input
                      placeholder="Réponse"
                      onChange={(e) =>
                        setAnswers({ ...answers, [z.id]: e.target.value })
                      }
                    />
                  )}
                </>
              )}
            </Rnd>
          ))}
        </div>
      )}

      {mode === "eleve" && (
        <button onClick={evaluate} style={{ marginTop: 20 }}>
          ✅ Envoyer / Corriger
        </button>
      )}
    </div>
  );
}