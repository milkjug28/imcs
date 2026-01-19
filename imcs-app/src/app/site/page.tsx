'use client'

export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #87CEEB 0%, #98D8E8 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <h1 style={{
        fontSize: '72px',
        color: '#fff',
        textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
        textAlign: 'center',
        marginBottom: '30px',
      }}>
        imaginary magic crypto savants
      </h1>

      <p style={{
        fontSize: '24px',
        color: '#000',
        textAlign: 'center',
        maxWidth: '600px',
        marginBottom: '40px',
      }}>
        welcome 2 da savant wurld! 🧙‍♂️✨
        <br /><br />
        we r building sum cool stuff here...
        <br />
        check back soon 4 voting, profiles, n more!
      </p>

      <div style={{
        background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
        border: '5px solid #000',
        padding: '30px',
        boxShadow: '10px 10px 0 #000',
        transform: 'rotate(-1deg)',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontSize: '32px',
          color: '#fff',
          textShadow: '2px 2px 0 #000',
          marginBottom: '20px',
        }}>
          coming soon:
        </h2>
        <ul style={{
          fontSize: '20px',
          color: '#000',
          listStyle: 'none',
          padding: 0,
          textAlign: 'left',
        }}>
          <li>✨ vote on savant submissions</li>
          <li>🎯 circle drawing test 2 submit</li>
          <li>⌨️ typing test 4 the slow ppl</li>
          <li>👤 savant profiles w/ scores</li>
          <li>🏆 leaderboard (top savants)</li>
          <li>✅ whitelist checker</li>
          <li>🎵 music n popup savants</li>
        </ul>
      </div>
    </div>
  )
}
