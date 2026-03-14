const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3002;

// Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || "https://sbexbkdgomzkzaovbhbq.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  "sb_publishable_GRGC_MNHItTAPDNa4EfdnA_KRc-hIne";

// Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8689129494:AAEWlQV9D_J_zCi-2TSeEqawn8kUEaoNes0";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "283522178";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sendToTelegram(name, phone, message) {
  const text = `Новая заявка!\nИмя: ${name}\nТелефон: ${phone}\nСообщение: ${message}`;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    });
    if (!res.ok) {
      console.error("Telegram API ошибка:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Ошибка отправки в Telegram:", err.message);
  }
}

app.use(cors());
app.use(express.json());

// Статика и главная страница
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/lead", async (req, res) => {
  try {
    const { name, phone, message } = req.body || {};

    if (!name || !phone || !message) {
      console.error("Ошибка: неполные данные заявки", { name, phone, message });
      return res.status(400).json({
        success: false,
        error: "Необходимо указать имя, телефон и сообщение",
      });
    }

    console.log("Новая заявка:", { name, phone, message });

    const { error } = await supabase.from("leads").insert([
      {
        name,
        phone,
        message,
        status: "new",
      },
    ]);

    if (error) {
      console.error("Ошибка сохранения заявки в Supabase:", error);
      return res.status(500).json({
        success: false,
        error: "Не удалось сохранить заявку",
      });
    }

    res.json({ success: true });

    sendToTelegram(name, phone, message).catch((err) =>
      console.error("Telegram:", err.message)
    );
  } catch (err) {
    console.error("Необработанная ошибка в /api/lead:", err);
    res.status(500).json({
      success: false,
      error: "Внутренняя ошибка сервера",
    });
  }
});

app.get("/api/leads", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, phone, message, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Ошибка загрузки заявок:", error);
      return res.status(500).json({
        success: false,
        error: "Не удалось загрузить заявки",
      });
    }

    res.json(data || []);
  } catch (err) {
    console.error("Необработанная ошибка в GET /api/leads:", err);
    res.status(500).json({
      success: false,
      error: "Внутренняя ошибка сервера",
    });
  }
});

app.patch("/api/leads/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, error: "Нет id" });
    }

    const updates = {};
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: "Нет полей для обновления" });
    }

    const { data, error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Ошибка обновления заявки:", error);
      return res.status(500).json({
        success: false,
        error: "Не удалось обновить заявку",
      });
    }

    res.json(data);
  } catch (err) {
    console.error("Необработанная ошибка в PATCH /api/leads/:id:", err);
    res.status(500).json({
      success: false,
      error: "Внутренняя ошибка сервера",
    });
  }
});

app.listen(PORT, () => {
  console.log("Сервер запущен на http://localhost:" + PORT);
});
