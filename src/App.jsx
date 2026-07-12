import { useState, useEffect } from 'react';
import './App.css';

export default function App() {

  const DEFECT_TRANSLATIONS = {
  'CRACK': 'Трещина металла',
  'GEOMETRY_DISTORTION': 'Нарушение геометрии лонжерона',
  'WELD_DEFECT': 'Дефект сварного шва',
  'MISSING_HOLE': 'Отсутствие отверстия',
  'UNKNOWN_DEFECT': 'Неизвестный дефект',
  'NONE': 'Геометрия в норме'
};

  const [frames, setFrames] = useState([]);
  
  const [currentTime, setCurrentTime] = useState(new Date());

  // статистика
  const [stats, setStats] = useState({
    total: 0,
    passed: 0,
    defect: 0,
    defectRate: 0
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    fetch('http://localhost:8080/api/v1/quality-control/stats')
      .then((response) => response.json())
      .then((dbStats) => {
        setStats({
          total: dbStats.totalChecked,
          passed: dbStats.totalPassed,
          defect: dbStats.totalDefects,
          defectRate: dbStats.defectRate.toFixed(1)
        });
      })
      .catch((error) => console.error('Ошибка загрузки глобальной статистики:', error));

    fetch('http://localhost:8080/api/v1/quality-control/history')
      .then((response) => response.json())
      .then((dbFrames) => {
        setFrames(dbFrames);
      })
      .catch((error) => console.error('Ошибка загрузки истории рам:', error));

    const eventSource = new EventSource('http://localhost:8080/api/v1/quality-control/stream');

    eventSource.addEventListener('frame-check', (event) => {
      const newFrame = JSON.parse(event.data);
      
      setFrames((prevFrames) => [newFrame, ...prevFrames]);

      setStats((prevStats) => {
        const isDefectFrame = newFrame.status === 'DEFECT' || newFrame.status === 'FAILED';
        const newTotal = prevStats.total + 1;
        const newDefect = isDefectFrame ? prevStats.defect + 1 : prevStats.defect;
        const newPassed = !isDefectFrame ? prevStats.passed + 1 : prevStats.passed;
        const newDefectRate = ((newDefect / newTotal) * 100).toFixed(1);

        return {
          total: newTotal,
          passed: newPassed,
          defect: newDefect,
          defectRate: newDefectRate
        };
      });
    });

    eventSource.onerror = () => {
      console.error('Ошибка SSE соединения');
    };

    return () => {
      clearInterval(timer);
      eventSource.close();
    };
  }, []);


  const isDefect = (status) => status === 'DEFECT' || status === 'FAILED';

  const formatLiveDateTime = (date) => {
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(',', '');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-text">
          <h1>Автоматизированный контроль рам</h1>
          <p className="subtitle">Информационная система ОТК | Мониторинг в реальном времени</p>
        </div>
        {}
        <div className="header-clock">
          {formatLiveDateTime(currentTime)}
        </div>
      </header>

      <div className="stats-panel">
        <div className="stat-card">
          <div className="stat-label">ПРОВЕРЕНО ВСЕГО РАМ</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card stat-card-passed">
          <div className="stat-label">ГОДНЫЕ (НОРМА)</div>
          <div className="stat-value">{stats.passed}</div>
        </div>
        <div className="stat-card stat-card-defect">
          <div className="stat-label">ВЫЯВЛЕННЫЙ БРАК</div>
          <div className="stat-value">{stats.defect}</div>
        </div>
        <div className="stat-card stat-card-rate">
          <div className="stat-label">ПРОЦЕНТ БРАКА</div>
          <div className="stat-value">{stats.defectRate}%</div>
        </div>
      </div>

      {frames.length === 0 ? (
        <div className="no-data">Ожидание движения конвейера и фиксации геометрии рам...</div>
      ) : (
        <div className="table-container">
          <div className="table-header">
            <div>СЕРИЙНЫЙ НОМЕР РАМЫ</div>
            <div>ВРЕМЯ РЕГИСТРАЦИИ</div>
            <div>РЕЗУЛЬТАТ АНАЛИЗА ГЕОМЕТРИИ</div>
            <div style={{ textAlign: 'right' }}>СТАТУС ОТК</div>
          </div>

          <div className="cards-container">
            {frames.map((frame, index) => {
              const hasError = isDefect(frame.status);
              return (
                <div 
                  key={frame.frameId + '-' + index} 
                  className={`card ${hasError ? 'card-defect' : 'card-passed'}`}
                >
                  <div className="frame-id">
                    <strong>{frame.frameId}</strong>
                  </div>
                  
                  <div className="frame-time">
                    {frame.formattedTime || '00:00:00'}
                  </div>
                  
                  <div className={`analysis-result ${hasError ? 'text-defect' : 'text-passed'}`}>
                    {hasError 
                    ? `Дефект: ${DEFECT_TRANSLATIONS[frame.defectType] || frame.defectType}` 
                    : 'Геометрия в норме'}
                  </div>

                  <div className="status-badge-wrapper">
                    <span className={`badge ${hasError ? 'badge-defect' : 'badge-passed'}`}>
                      {hasError ? 'КРИТИЧЕСКИЙ БРАК' : 'ОТК ПРИНЯТО'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
