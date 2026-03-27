import React, { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { createClient } from "@supabase/supabase-js";

pdfjs.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// 🔑 CONFIG
const supabase = createClient(
  "https://TON-PROJET.supabase.co",
  "TA_ANON_KEY"
);

export default function App() {
  const [mode, setMode] = useState("prof");
  const [pdfFile, setPdfFile] = useState(null);
  const [zones, setZones] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [exerciseId, setExerciseId] = useState(null);
  const [studentName, setStudentName] = useState("");

  const containerRef = useRef(null);

  // 🔗 Charger exercice depuis URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      setMode("eleve");
      loadExercise(id);
    }
  }, []);

  const uploadPdf = (e) => {
    const file = e.target.files[0];
    if (file) setPdfFile(file);
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
        type: "qcm",
        question: "Question ?",
        options: ["A", "B"],
        correct: [],
        correctText: "",
        points: 2
      },
    ]);
  };

  const updateZone = (id, data) => {
    setZones(zones.map((z) => (z.id === id ? { ...z, ...data } : z)));
  };

  // 💾 Sauvegarde exercice
  const saveExercise = async () => {
    const { data } = await supabase
      .from("exercises")
      .insert([{ data: { zones } }])
      .select()
      .single();

    setExerciseId(data.id);

    alert(
      "Lien élève : " +
        window.location.origin +
        "?id=" +
        data.id
    );
  };

  // 📥 Charger exercice
  const loadExercise = async (id) => {
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", id)
      .single();

    if (data) {
      setZones(data.data.zones);
      setExerciseId(id);
    }
  };

  // 🎯 Correction + sauvegarde
  const evaluate = async () => {
    let total = 0;
    let score = 0;

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
        if (
          ans &&
          ans.toLowerCase().trim() ===
            z.correctText.toLowerCase().trim()
        ) {
          score += z.points;
        }
      }
    });

    setScore(`${score.toFixed(2)} / ${total}`);

    // 💾 sauvegarde réponse
    await supabase.from("responses").insert([
      {
        exercise_id: exerciseId,
        student_name: studentName,
        answers,
        score
      }
    ]);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>📄 EduPDF SaaS</h1>

      <button onClick={() => setMode("prof")}>👨‍🏫 Prof</button>
      <button onClick={() => setMode("eleve")}>👨‍🎓 Élève</button>

      {mode === "prof" && (
        <>
          <input type="file" onChange={uploadPdf} />
          <button onClick={saveExercise}>
            💾 Générer lien élève
          </button>
        </>
      )}

      {mode === "eleve" && (
        <input
          placeholder="Nom élève"
          onChange={(e) => setStudentName(e.target.value)}
        />
      )}

      <div
        ref={containerRef}
        onClick={addZone}
        style={{
          position: "relative",
          marginTop: 20,
          border: "1px solid gray"
        }}
      >
        {pdfFile && (
          <Document file={pdfFile}>
            <Page pageNumber={1} />
          </Document>
        )}

        {zones.map((z) => (
          <div
            key={z.id}
            style={{
              position: "absolute",
              left: z.x,
              top: z.y,
              width: z.width,
              background: "white",
              border: "2px solid blue",
              padding: 5
            }}
          >
            <div>{z.question}</div>

            {z.type === "qcm" &&
              z.options.map((opt, i) => (
                <label key={i}>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      let current = answers[z.id] || [];
                      if (e.target.checked) current.push(i);
                      else current = current.filter(c => c !== i);
                      setAnswers({ ...answers, [z.id]: current });
                    }}
                  />
                  {opt}
                </label>
              ))}

            {z.type === "text" && (
              <input
                onChange={(e) =>
                  setAnswers({
                    ...answers,
                    [z.id]: e.target.value
                  })
                }
              />
            )}
          </div>
        ))}
      </div>

      {mode === "eleve" && (
        <>
          <button onClick={evaluate}>
            ✅ Corriger
          </button>
          {score && <h2>Score : {score}</h2>}
        </>
      )}
    </div>
  );
}