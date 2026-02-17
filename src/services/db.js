import Dexie from 'dexie';

export const db = new Dexie('RamadhanAppDB');

db.version(1).stores({
  students: '++id, name, class', 
  activities: '++id, studentId, date, type, status'
});

db.on('populate', () => {
  db.students.bulkAdd([
    { name: 'Ahmad', class: '1A' },
    { name: 'Budi', class: '1B' },
    { name: 'Citra', class: '1A' },
    { name: 'Doni', class: '1B' },
    { name: 'Eka', class: '1A' },
    { name: 'Fahmi', class: '1B' },
    { name: 'Gita', class: '1A' },
    { name: 'Hadi', class: '1B' },
    { name: 'Indah', class: '1A' },
    { name: 'Joko', class: '1B' },
    { name: 'Kartika', class: '1A' },
    { name: 'Lutfi', class: '1B' },
    { name: 'Maya', class: '1A' },
    { name: 'Naufal', class: '1B' },
    { name: 'Olivia', class: '1A' },
    { name: 'Putra', class: '1B' },
    { name: 'Qori', class: '1A' },
    { name: 'Rizky', class: '1B' },
    { name: 'Sari', class: '1A' },
    { name: 'Toni', class: '1B' },
    { name: 'Umi', class: '1A' },
    { name: 'Vino', class: '1B' },
    { name: 'Wulan', class: '1A' },
    { name: 'Yusuf', class: '1B' },
    { name: 'Zahra', class: '1A' },
  ]);
});
