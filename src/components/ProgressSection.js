import React from 'react';

const ProgressSection = ({ progress, onStart, onPause }) => {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const getStatusClass = (status) => {
    const base = 'status';
    const statusMap = {
      idle: 'idle',
      running: 'running',
      completed: 'completed',
      error: 'error',
      paused: 'paused',
    };
    return `${base} ${statusMap[status] || 'idle'}`;
  };

  return (
    <div className="section progress-section" style={{ background: 'rgba(10, 15, 25, 0.8)', padding: '20px', borderRadius: '4px', marginTop: '20px', border: '1px solid rgba(0, 153, 255, 0.2)' }}>
      <h2>📊 Progress</h2>
      <div className="progress-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#88aacc' }}>
        <span>
          Status: <span className={getStatusClass(progress.status)} style={{
            padding: '8px 15px',
            borderRadius: '2px',
            fontWeight: 500,
            display: 'inline-block',
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            border: '1px solid',
            ...(progress.status === 'idle' && {
              background: 'rgba(100, 100, 100, 0.2)',
              color: '#888888',
              borderColor: 'rgba(100, 100, 100, 0.4)',
            }),
            ...(progress.status === 'running' && {
              background: 'rgba(0, 200, 100, 0.2)',
              color: '#00ff88',
              borderColor: 'rgba(0, 200, 100, 0.4)',
            }),
            ...(progress.status === 'completed' && {
              background: 'rgba(0, 153, 255, 0.2)',
              color: '#00ccff',
              borderColor: 'rgba(0, 153, 255, 0.4)',
            }),
            ...(progress.status === 'error' && {
              background: 'rgba(255, 50, 50, 0.2)',
              color: '#ff6666',
              borderColor: 'rgba(255, 50, 50, 0.4)',
            }),
            ...(progress.status === 'paused' && {
              background: 'rgba(255, 153, 0, 0.2)',
              color: '#ffaa00',
              borderColor: 'rgba(255, 153, 0, 0.4)',
            }),
          }}>
            {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
          </span>
        </span>
        <span>{progress.current} / {progress.total}</span>
      </div>
      <div className="progress-bar-container" style={{
        background: 'rgba(5, 10, 20, 0.8)',
        borderRadius: '2px',
        height: '30px',
        overflow: 'hidden',
        margin: '15px 0',
        border: '1px solid rgba(0, 153, 255, 0.3)',
        position: 'relative',
      }}>
        <div
          className="progress-bar"
          style={{
            background: 'linear-gradient(90deg, rgba(0, 102, 255, 0.8) 0%, rgba(0, 204, 255, 0.8) 50%, rgba(0, 102, 255, 0.8) 100%)',
            height: '100%',
            width: `${percentage}%`,
            transition: 'width 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 500,
            fontSize: '0.9rem',
            textShadow: '0 0 5px rgba(0, 204, 255, 0.8)',
            boxShadow: '0 0 20px rgba(0, 204, 255, 0.5)',
          }}
        >
          {percentage > 0 ? `${percentage}%` : ''}
        </div>
      </div>
      <div style={{ color: '#88aacc', marginTop: '10px' }}>{progress.message || 'Ready to start'}</div>
      <div className="actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button
          className="btn btn-success"
          onClick={onStart}
          disabled={progress.status === 'running'}
        >
          Start Sending
        </button>
        <button
          className="btn btn-danger"
          onClick={onPause}
          disabled={progress.status !== 'running'}
        >
          Pause
        </button>
      </div>
    </div>
  );
};

export default ProgressSection;

