import { useEffect, useState } from 'react'
import { hasSupabaseEnv, supabase, vercelEnv } from './lib/supabase'
import './App.css'

const setupSteps = [
  'Salin .env.example menjadi .env.local.',
  'Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY.',
  'Jalankan SQL di supabase/todos_schema.sql pada Supabase SQL Editor.',
  'Pastikan Email provider aktif di Authentication > Providers.',
]

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatTimestamp(value) {
  if (!value) {
    return '-'
  }

  return dateFormatter.format(new Date(value))
}

async function fetchTodosFromSupabase() {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('todos')
    .select('id, task, is_done, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

function App() {
  const [session, setSession] = useState(null)
  const [todos, setTodos] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [task, setTask] = useState('')
  const [notice, setNotice] = useState(null)
  const [isBooting, setIsBooting] = useState(hasSupabaseEnv)
  const [isAuthBusy, setIsAuthBusy] = useState(false)
  const [isTodoBusy, setIsTodoBusy] = useState(false)

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    async function loadSession() {
      const {
        data: { session: initialSession },
        error,
      } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (error) {
        setNotice({ type: 'error', text: error.message })
      }

      setSession(initialSession ?? null)
      setIsBooting(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return
      }

      setSession(nextSession)

      if (!nextSession) {
        setTodos([])
        setTask('')
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user) {
      return
    }

    let isMounted = true

    async function loadTodos() {
      try {
        const nextTodos = await fetchTodosFromSupabase()

        if (isMounted) {
          setTodos(nextTodos)
        }
      } catch (error) {
        if (isMounted) {
          setNotice({ type: 'error', text: error.message })
        }
      }
    }

    loadTodos()

    return () => {
      isMounted = false
    }
  }, [session])

  async function refreshTodos() {
    try {
      const nextTodos = await fetchTodosFromSupabase()
      setTodos(nextTodos)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function handleRegister(event) {
    event.preventDefault()

    if (!supabase) {
      return
    }

    if (!email.trim() || !password.trim()) {
      setNotice({ type: 'error', text: 'Email dan password wajib diisi.' })
      return
    }

    setIsAuthBusy(true)
    setNotice(null)

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    })

    if (error) {
      setNotice({ type: 'error', text: error.message })
    } else {
      setNotice({
        type: 'success',
        text: 'Registrasi berhasil. Jika confirm email aktif, cek inbox untuk verifikasi.',
      })
    }

    setIsAuthBusy(false)
  }

  async function handleLogin(event) {
    event.preventDefault()

    if (!supabase) {
      return
    }

    if (!email.trim() || !password.trim()) {
      setNotice({ type: 'error', text: 'Email dan password wajib diisi.' })
      return
    }

    setIsAuthBusy(true)
    setNotice(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    })

    if (error) {
      setNotice({ type: 'error', text: error.message })
    } else {
      setNotice({ type: 'success', text: 'Login berhasil.' })
      setPassword('')
    }

    setIsAuthBusy(false)
  }

  async function handleLogout() {
    if (!supabase) {
      return
    }

    setIsTodoBusy(true)

    const { error } = await supabase.auth.signOut()

    if (error) {
      setNotice({ type: 'error', text: error.message })
    } else {
      setNotice({ type: 'success', text: 'Session berhasil ditutup.' })
    }

    setIsTodoBusy(false)
  }

  async function handleAddTodo(event) {
    event.preventDefault()

    if (!supabase || !session?.user) {
      return
    }

    if (!task.trim()) {
      setNotice({ type: 'error', text: 'Task tidak boleh kosong.' })
      return
    }

    setIsTodoBusy(true)
    setNotice(null)

    const { error } = await supabase.from('todos').insert({
      user_id: session.user.id,
      task: task.trim(),
    })

    if (error) {
      setNotice({ type: 'error', text: error.message })
      setIsTodoBusy(false)
      return
    }

    setTask('')
    setNotice({ type: 'success', text: 'Todo berhasil ditambahkan.' })
    await refreshTodos()
    setIsTodoBusy(false)
  }

  async function handleToggleTodo(todo) {
    if (!supabase) {
      return
    }

    setIsTodoBusy(true)

    const { error } = await supabase
      .from('todos')
      .update({ is_done: !todo.is_done })
      .eq('id', todo.id)

    if (error) {
      setNotice({ type: 'error', text: error.message })
      setIsTodoBusy(false)
      return
    }

    setNotice({
      type: 'success',
      text: todo.is_done ? 'Todo diaktifkan lagi.' : 'Todo ditandai selesai.',
    })
    await refreshTodos()
    setIsTodoBusy(false)
  }

  async function handleDeleteTodo(todoId) {
    if (!supabase) {
      return
    }

    setIsTodoBusy(true)

    const { error } = await supabase.from('todos').delete().eq('id', todoId)

    if (error) {
      setNotice({ type: 'error', text: error.message })
      setIsTodoBusy(false)
      return
    }

    setNotice({ type: 'success', text: 'Todo berhasil dihapus.' })
    await refreshTodos()
    setIsTodoBusy(false)
  }

  if (!hasSupabaseEnv) {
    return (
      <main className="page-shell">
        <section className="panel panel--wide">
          <div className="panel__header">
            <span className="badge">Setup diperlukan</span>
            <span className="pill">Environment: {vercelEnv}</span>
          </div>
          <h1 className="panel__title">Contoh project React + Supabase sudah siap.</h1>
          <p className="panel__lead">
            Isi environment variable Supabase agar aplikasi bisa login, menyimpan todo, dan
            dideploy ke Vercel tanpa perubahan tambahan.
          </p>

          <div className="setup-grid">
            <div className="panel panel--soft">
              <h2>Checklist awal</h2>
              <ol className="steps">
                {setupSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="panel panel--soft">
              <h2>Variable yang dibutuhkan</h2>
              <pre className="code-block">
                <code>{`VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY`}</code>
              </pre>
              <p className="muted">
                Lihat file <code>.env.example</code> dan <code>supabase/todos_schema.sql</code>.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (isBooting) {
    return (
      <main className="page-shell">
        <section className="panel panel--wide">
          <div className="panel__header">
            <span className="badge">Memuat session</span>
            <span className="pill">Environment: {vercelEnv}</span>
          </div>
          <h1 className="panel__title">Menghubungkan aplikasi ke Supabase.</h1>
          <p className="panel__lead">Menyiapkan session lokal dan sinkronisasi auth state.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <span className="badge">Demo project</span>
          <h1 className="hero__title">React, Vercel, dan Supabase dalam satu alur kerja.</h1>
          <p className="hero__lead">
            Project ini mengikuti tutorial di repository ini: auth email/password, todo list,
            dan database dengan RLS.
          </p>
        </div>
        <div className="hero__meta">
          <span className="pill">Environment: {vercelEnv}</span>
          <span className="pill">
            {session?.user ? `Login sebagai ${session.user.email}` : 'Belum login'}
          </span>
        </div>
      </section>

      {notice ? (
        <section className={`notice notice--${notice.type}`}>
          <p>{notice.text}</p>
        </section>
      ) : null}

      <section className="workspace">
        <article className="panel">
          <div className="panel__header">
            <h2>{session?.user ? 'Kelola todo' : 'Masuk atau daftar'}</h2>
            {session?.user ? (
              <button className="button button--ghost" onClick={handleLogout} disabled={isTodoBusy}>
                Logout
              </button>
            ) : null}
          </div>

          {!session?.user ? (
            <form className="stack" onSubmit={handleLogin}>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="nama@contoh.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <div className="actions">
                <button className="button" type="submit" disabled={isAuthBusy}>
                  {isAuthBusy ? 'Memproses...' : 'Login'}
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={handleRegister}
                  disabled={isAuthBusy}
                >
                  Register
                </button>
              </div>
            </form>
          ) : (
            <div className="stack">
              <form className="composer" onSubmit={handleAddTodo}>
                <label className="field field--grow">
                  <span>Task baru</span>
                  <input
                    type="text"
                    placeholder="Contoh: Deploy ke Vercel"
                    value={task}
                    onChange={(event) => setTask(event.target.value)}
                  />
                </label>
                <button className="button" type="submit" disabled={isTodoBusy}>
                  {isTodoBusy ? 'Menyimpan...' : 'Tambah'}
                </button>
              </form>

              <div className="stats">
                <div className="stat-card">
                  <strong>{todos.length}</strong>
                  <span>Total todo</span>
                </div>
                <div className="stat-card">
                  <strong>{todos.filter((todo) => todo.is_done).length}</strong>
                  <span>Selesai</span>
                </div>
                <div className="stat-card">
                  <strong>{todos.filter((todo) => !todo.is_done).length}</strong>
                  <span>Aktif</span>
                </div>
              </div>

              <div className="todo-list">
                {todos.length === 0 ? (
                  <div className="todo-empty">
                    <h3>Belum ada todo</h3>
                    <p>Tambahkan task pertama untuk menguji insert dan RLS di Supabase.</p>
                  </div>
                ) : (
                  todos.map((todo) => (
                    <article className="todo-card" key={todo.id}>
                      <div>
                        <h3 className={todo.is_done ? 'todo-card__title is-done' : 'todo-card__title'}>
                          {todo.task}
                        </h3>
                        <p className="muted">Dibuat {formatTimestamp(todo.created_at)}</p>
                      </div>

                      <div className="actions">
                        <button
                          className="button button--secondary"
                          onClick={() => handleToggleTodo(todo)}
                          disabled={isTodoBusy}
                        >
                          {todo.is_done ? 'Aktifkan' : 'Selesai'}
                        </button>
                        <button
                          className="button button--ghost"
                          onClick={() => handleDeleteTodo(todo.id)}
                          disabled={isTodoBusy}
                        >
                          Hapus
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </article>

        <aside className="panel panel--soft">
          <div className="panel__header">
            <h2>Petunjuk cepat</h2>
            <span className="pill">RLS aktif</span>
          </div>

          <ul className="bullet-list">
            <li>Project memakai publishable key, bukan service role.</li>
            <li>Tabel `public.todos` dibatasi policy `auth.uid() = user_id`.</li>
            <li>Set env yang sama di `.env.local` dan Vercel Project Settings.</li>
            <li>Jika confirm email aktif, verifikasi dulu sebelum login penuh.</li>
          </ul>

          <div className="note-box">
            <h3>File penting</h3>
            <p>
              <code>src/lib/supabase.js</code> untuk client, <code>supabase/todos_schema.sql</code>{' '}
              untuk schema, dan <code>.env.example</code> untuk template env.
            </p>
          </div>
        </aside>
      </section>
    </main>
  )
}

export default App
