import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EmployeeForm } from '@/components/employees/employee-form'
import type { EmployeeFormValues } from '@/components/employees/employee-form'
import type { Employee } from '@/lib/api-client'

const EMPLOYEE_1: Employee = {
  id: '1',
  business_id: 'biz-test',
  nama_lengkap: 'Budi Santoso',
  no_ktp: '3201234567890001',
  npwp: '01.234.567.8-901.000',
  tanggal_lahir: '1995-04-12',
  jenis_kelamin: 'L',
  alamat: 'Jl. Melati No. 12, Jakarta Selatan',
  kontak_darurat: '+62 812-3456-7890',
  tanggal_masuk: '2023-01-12',
  jenis_kontrak: 'pkwtt',
  status: 'aktif',
  ptkp_status: null,
  custom_fields: {},
}

const VALID_VALUES: Record<keyof EmployeeFormValues, string> = {
  nama_lengkap: 'Budi Santoso Baru',
  tanggal_lahir: '1995-04-12',
  jenis_kontrak: 'PKWT',
  tanggal_masuk: '2023-01-12',
  alamat: 'Jl. Melati No. 12, Jakarta Selatan',
  kontak_darurat: '+62 812-3456-7890',
  no_ktp: '3201234567890001',
  npwp: '01.234.567.8-901.000',
}

function fill(overrides: Partial<Record<keyof EmployeeFormValues, string>> = {}) {
  const values = { ...VALID_VALUES, ...overrides }
  fireEvent.change(screen.getByLabelText(/Nama Lengkap/), { target: { value: values.nama_lengkap } })
  fireEvent.change(screen.getByLabelText(/Tanggal Lahir/), { target: { value: values.tanggal_lahir } })
  fireEvent.change(screen.getByLabelText(/Jenis Kontrak/), { target: { value: values.jenis_kontrak } })
  fireEvent.change(screen.getByLabelText(/Tanggal Masuk/), { target: { value: values.tanggal_masuk } })
  fireEvent.change(screen.getByLabelText(/Alamat/), { target: { value: values.alamat } })
  fireEvent.change(screen.getByLabelText(/Kontak Darurat/), { target: { value: values.kontak_darurat } })
  fireEvent.change(screen.getByLabelText(/Nomor KTP/), { target: { value: values.no_ktp } })
  fireEvent.change(screen.getByLabelText(/NPWP/), { target: { value: values.npwp } })
}

function renderForm(props: Partial<Parameters<typeof EmployeeForm>[0]> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn(async () => {})
  const onCancel = props.onCancel ?? vi.fn()
  render(
    <EmployeeForm
      initialValues={props.initialValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  )
  return { onSubmit, onCancel }
}

describe('EmployeeForm', () => {
  it('memblokir submit form kosong dan menampilkan error validasi', () => {
    const { onSubmit } = renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(screen.getByText('Nama lengkap wajib diisi')).toBeInTheDocument()
    expect(screen.getByText('Tanggal lahir wajib diisi')).toBeInTheDocument()
    expect(screen.getByText('Jenis kontrak wajib dipilih')).toBeInTheDocument()
    expect(screen.getByText('Tanggal masuk wajib diisi')).toBeInTheDocument()
    expect(screen.getByText('Alamat wajib diisi')).toBeInTheDocument()
    expect(screen.getByText('Kontak darurat wajib diisi')).toBeInTheDocument()
    expect(screen.getByText('Nomor KTP wajib diisi')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('validasi berjalan real-time saat blur field', () => {
    renderForm()

    fireEvent.change(screen.getByLabelText(/Nama Lengkap/), { target: { value: 'Bu' } })
    fireEvent.blur(screen.getByLabelText(/Nama Lengkap/))

    expect(screen.getByText('Nama lengkap minimal 3 karakter')).toBeInTheDocument()
  })

  it('submit form valid memanggil onSubmit dengan nilai form', async () => {
    const { onSubmit } = renderForm()
    fill()

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith(VALID_VALUES)
  })

  it('no_ktp menolak input kurang/lebih dari 16 digit atau berhuruf', () => {
    const { onSubmit } = renderForm()
    fill({ no_ktp: '123' })

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(screen.getByText('Nomor KTP harus 16 digit angka')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/Nomor KTP/), { target: { value: 'abcd123456789012' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('npwp menolak format tidak valid', () => {
    const { onSubmit } = renderForm()
    fill({ npwp: '12.34' })

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(
      screen.getByText('Format NPWP tidak valid (contoh: 01.234.567.8-901.000)'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('npwp kosong tetap lolos validasi (opsional)', async () => {
    const { onSubmit } = renderForm()
    fill({ npwp: '' })

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  })

  it('mode edit mengisi nilai field dari initialValues', () => {
    renderForm({ initialValues: EMPLOYEE_1 })

    expect(screen.getByLabelText(/Nama Lengkap/)).toHaveValue('Budi Santoso')
    expect(screen.getByLabelText(/Tanggal Lahir/)).toHaveValue('1995-04-12')
    expect(screen.getByLabelText(/Jenis Kontrak/)).toHaveValue('PKWTT')
    expect(screen.getByLabelText(/Tanggal Masuk/)).toHaveValue('2023-01-12')
    expect(screen.getByLabelText(/Alamat/)).toHaveValue('Jl. Melati No. 12, Jakarta Selatan')
    expect(screen.getByLabelText(/Kontak Darurat/)).toHaveValue('+62 812-3456-7890')
    expect(screen.getByLabelText(/Nomor KTP/)).toHaveValue('3201234567890001')
    expect(screen.getByLabelText(/NPWP/)).toHaveValue('01.234.567.8-901.000')
  })

  it('menolak tanggal lahir di bawah 17 tahun', () => {
    const { onSubmit } = renderForm()
    fill({ tanggal_lahir: '2015-01-01' })

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(screen.getByText('Usia minimal 17 tahun untuk menjadi karyawan')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('menolak tanggal masuk di masa depan', () => {
    const { onSubmit } = renderForm()
    fill({ tanggal_masuk: '2099-01-01' })

    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(screen.getByText('Tanggal masuk tidak boleh di masa depan')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('tombol Batal memanggil callback onCancel', () => {
    const onCancel = vi.fn()
    renderForm({ onCancel })

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})