/**
 * KaryawanKu — mock employee master data (FE-only, ticket #5).
 *
 * Full profile records backing `/employees` and `/employees/[id]`. Every
 * `noKtp` is 16 digits, every `npwp` is 15 digits in the canonical
 * `XX.XXX.XXX.X-XXX.XXX` format, so validation rules match the fixtures.
 */

export type EmployeeStatus = 'aktif' | 'nonaktif'

export interface CustomField {
  key: string
  value: string
}

export interface EmployeeDetail {
  id: string
  nik: string
  nama: string
  jabatan: string
  status: EmployeeStatus
  jenisKelamin: string
  tanggalLahir: string
  alamat: string
  kontakDarurat: string
  noKtp: string
  npwp: string
  tanggalMasuk: string
  jenisKontrak: string
  customFields: CustomField[]
}

const EMPLOYEES: EmployeeDetail[] = [
  {
    id: '1',
    nik: 'KRY-001',
    nama: 'Budi Santoso',
    jabatan: 'Kepala Barista',
    status: 'aktif',
    jenisKelamin: 'Laki-laki',
    tanggalLahir: '1995-04-12',
    alamat: 'Jl. Melati No. 12, Jakarta Selatan',
    kontakDarurat: '+62 812-3456-7890',
    noKtp: '3201234567890001',
    npwp: '01.234.567.8-901.000',
    tanggalMasuk: '2023-01-12',
    jenisKontrak: 'PKWTT',
    customFields: [
      { key: 'Ukuran Seragam', value: 'M' },
      { key: 'Nomor SIM', value: '1234567890' },
      { key: 'Bank', value: 'BCA' },
      { key: 'No. Rekening', value: '123-456-7890' },
    ],
  },
  {
    id: '2',
    nik: 'KRY-002',
    nama: 'Siti Nurhaliza',
    jabatan: 'Kasir',
    status: 'aktif',
    jenisKelamin: 'Perempuan',
    tanggalLahir: '1998-08-21',
    alamat: 'Jl. Anggrek No. 3, Depok',
    kontakDarurat: '0812-9876-5432',
    noKtp: '3273011234567890',
    npwp: '02.345.678.9-012.000',
    tanggalMasuk: '2023-03-03',
    jenisKontrak: 'PKWTT',
    customFields: [
      { key: 'Ukuran Seragam', value: 'S' },
      { key: 'Bank', value: 'Mandiri' },
      { key: 'No. Rekening', value: '987-654-3210' },
    ],
  },
  {
    id: '3',
    nik: 'KRY-003',
    nama: 'Ahmad Fauzi',
    jabatan: 'Barista',
    status: 'aktif',
    jenisKelamin: 'Laki-laki',
    tanggalLahir: '2001-02-14',
    alamat: 'Jl. Kenanga No. 8, Bekasi',
    kontakDarurat: '+62 813-1111-2222',
    noKtp: '3578010987654321',
    npwp: '03.456.789.0-123.000',
    tanggalMasuk: '2024-07-17',
    jenisKontrak: 'PKWT',
    customFields: [
      { key: 'Ukuran Seragam', value: 'L' },
      { key: 'Nomor SIM', value: '0987654321' },
      { key: 'Bank', value: 'BCA' },
    ],
  },
  {
    id: '4',
    nik: 'KRY-004',
    nama: 'Dewi Lestari',
    jabatan: 'Pramusaji',
    status: 'aktif',
    jenisKelamin: 'Perempuan',
    tanggalLahir: '2003-11-03',
    alamat: 'Jl. Cempaka No. 5, Tangerang',
    kontakDarurat: '0813-3333-4444',
    noKtp: '3275021122334455',
    npwp: '04.567.890.1-234.000',
    tanggalMasuk: '2026-02-02',
    jenisKontrak: 'PKL',
    customFields: [{ key: 'Ukuran Seragam', value: 'M' }],
  },
  {
    id: '5',
    nik: 'KRY-005',
    nama: 'Rudi Hermawan',
    jabatan: 'Kasir',
    status: 'nonaktif',
    jenisKelamin: 'Laki-laki',
    tanggalLahir: '1990-07-19',
    alamat: 'Jl. Dahlia No. 21, Jakarta Timur',
    kontakDarurat: '0821-5555-6666',
    noKtp: '3101012233445566',
    npwp: '05.678.901.2-345.000',
    tanggalMasuk: '2022-09-08',
    jenisKontrak: 'PKWTT',
    customFields: [
      { key: 'Bank', value: 'BRI' },
      { key: 'No. Rekening', value: '111-222-3333' },
    ],
  },
  {
    id: '6',
    nik: 'KRY-006',
    nama: 'Maya Sari',
    jabatan: 'Admin',
    status: 'aktif',
    jenisKelamin: 'Perempuan',
    tanggalLahir: '1996-05-27',
    alamat: 'Jl. Mawar No. 2, Bogor',
    kontakDarurat: '+62 812-7777-8888',
    noKtp: '3174023344556677',
    npwp: '06.789.012.3-456.000',
    tanggalMasuk: '2025-11-21',
    jenisKontrak: 'PKWT',
    customFields: [],
  },
  {
    id: '7',
    nik: 'KRY-007',
    nama: 'Fajar Nugraha',
    jabatan: 'Barista',
    status: 'aktif',
    jenisKelamin: 'Laki-laki',
    tanggalLahir: '1999-09-09',
    alamat: 'Jl. Flamboyan No. 14, Depok',
    kontakDarurat: '0819-9999-0000',
    noKtp: '3578034455667788',
    npwp: '07.890.123.4-567.000',
    tanggalMasuk: '2025-04-14',
    jenisKontrak: 'PKWT',
    customFields: [{ key: 'Ukuran Seragam', value: 'XL' }],
  },
  {
    id: '8',
    nik: 'KRY-008',
    nama: 'Lestari Wulandari',
    jabatan: 'Supervisor',
    status: 'nonaktif',
    jenisKelamin: 'Perempuan',
    tanggalLahir: '1992-12-01',
    alamat: 'Jl. Cendrawasih No. 7, Jakarta Selatan',
    kontakDarurat: '0822-1212-3434',
    noKtp: '3275045566778899',
    npwp: '08.901.234.5-678.000',
    tanggalMasuk: '2022-06-20',
    jenisKontrak: 'PKWTT',
    customFields: [
      { key: 'Bank', value: 'BNI' },
      { key: 'No. Rekening', value: '555-666-7777' },
    ],
  },
  {
    id: '9',
    nik: 'KRY-009',
    nama: 'Indra Permadi',
    jabatan: 'Pramusaji',
    status: 'aktif',
    jenisKelamin: 'Laki-laki',
    tanggalLahir: '2002-03-15',
    alamat: 'Jl. Kamboja No. 9, Bekasi',
    kontakDarurat: '+62 815-4545-6767',
    noKtp: '3578056677889900',
    npwp: '09.012.345.6-789.000',
    tanggalMasuk: '2026-01-05',
    jenisKontrak: 'Harian',
    customFields: [{ key: 'Ukuran Seragam', value: 'M' }],
  },
  {
    id: '10',
    nik: 'KRY-010',
    nama: 'Ratna Sari',
    jabatan: 'Kasir',
    status: 'aktif',
    jenisKelamin: 'Perempuan',
    tanggalLahir: '1997-06-30',
    alamat: 'Jl. Teratai No. 11, Tangerang',
    kontakDarurat: '0812-6767-8989',
    noKtp: '3275067788990011',
    npwp: '10.123.456.7-890.000',
    tanggalMasuk: '2024-12-01',
    jenisKontrak: 'PKWT',
    customFields: [
      { key: 'Ukuran Seragam', value: 'S' },
      { key: 'Bank', value: 'Mandiri' },
      { key: 'No. Rekening', value: '222-333-4444' },
    ],
  },
  {
    id: '11',
    nik: 'KRY-011',
    nama: 'Hendro Wibowo',
    jabatan: 'Kurir',
    status: 'aktif',
    jenisKelamin: 'Laki-laki',
    tanggalLahir: '1994-01-25',
    alamat: 'Jl. Jambu No. 18, Bogor',
    kontakDarurat: '+62 821-1212-2323',
    noKtp: '3578078899001122',
    npwp: '11.234.567.8-901.000',
    tanggalMasuk: '2026-05-11',
    jenisKontrak: 'Harian',
    customFields: [
      { key: 'Ukuran Seragam', value: 'L' },
      { key: 'Nomor SIM', value: '1122334455' },
      { key: 'Bank', value: 'BCA' },
      { key: 'No. Rekening', value: '777-888-9999' },
    ],
  },
  {
    id: '12',
    nik: 'KRY-012',
    nama: 'Ani Rahmawati',
    jabatan: 'Pramusaji',
    status: 'aktif',
    jenisKelamin: 'Perempuan',
    tanggalLahir: '2005-10-10',
    alamat: 'Jl. Seruni No. 4, Jakarta Utara',
    kontakDarurat: '0813-9090-8080',
    noKtp: '3275089900112233',
    npwp: '12.345.678.9-012.000',
    tanggalMasuk: '2026-03-30',
    jenisKontrak: 'Magang',
    customFields: [{ key: 'Ukuran Seragam', value: 'S' }],
  },
]

export function getEmployeeById(id: string | undefined): EmployeeDetail | undefined {
  if (!id) return undefined
  return EMPLOYEES.find((e) => e.id === id)
}