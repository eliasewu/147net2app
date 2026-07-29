module.exports = function(app, pool, auth, roles) {
  // GET users
  app.get("/api/users", auth, roles("super_admin","admin"), async (req, res) => {
    try {
      const r = await pool.query("SELECT id, username, email, role, permissions, client_id, supplier_id, name, is_active, last_login FROM users ORDER BY id");
      res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  
  // POST user
  app.post("/api/users", auth, roles("super_admin","admin"), async (req, res) => {
    try {
      const bcrypt = require("bcryptjs");
      const { username, email, password, role, permissions, client_id, supplier_id, name } = req.body;
      const hash = bcrypt.hashSync(password || "changeme123", 10);
      const r = await pool.query("INSERT INTO users (username, email, password_hash, role, permissions, client_id, supplier_id, name, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING id, username, email, role, permissions, name, is_active", [username, email, hash, role, permissions || "{}", client_id || null, supplier_id || null, name || username]);
      res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  
  // PUT user
  app.put("/api/users/:id", auth, roles("super_admin","admin"), async (req, res) => {
    try {
      const { password, username, email, role, permissions, name, is_active } = req.body;
      const updates = []; const vals = []; let idx = 1;
      if (username !== undefined) { updates.push("username=$" + idx++); vals.push(username); }
      if (email !== undefined) { updates.push("email=$" + idx++); vals.push(email); }
      if (role !== undefined) { updates.push("role=$" + idx++); vals.push(role); }
      if (permissions !== undefined) { updates.push("permissions=$" + idx++); vals.push(permissions); }
      if (name !== undefined) { updates.push("name=$" + idx++); vals.push(name); }
      if (is_active !== undefined) { updates.push("is_active=$" + idx++); vals.push(is_active); }
      if (password) { const bcrypt = require("bcryptjs"); updates.push("password_hash=$" + idx++); vals.push(bcrypt.hashSync(password, 10)); }
      if (updates.length > 0) { vals.push(req.params.id); await pool.query("UPDATE users SET " + updates.join(",") + " WHERE id=$" + idx, vals); }
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  
  // DELETE user
  app.delete("/api/users/:id", auth, roles("super_admin"), async (req, res) => {
    try {
      if (req.params.id == "1") return res.status(400).json({ error: "Cannot delete super admin" });
      await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  
  console.log("[API] Users CRUD endpoints loaded");
};
