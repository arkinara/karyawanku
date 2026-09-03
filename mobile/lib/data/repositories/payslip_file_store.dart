import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// Saves a downloaded payslip PDF to the device and hands it to the platform
/// share sheet. The app directory is used so no storage permission is required
/// on Android; the share sheet then lets the user open the file in a viewer or
/// send it (email, WhatsApp, …).
///
/// Injectable so provider tests can record the write without platform channels.
class PayslipFileStore {
  const PayslipFileStore();

  /// Writes [bytes] to `getApplicationDocumentsDirectory()/payslips/{fileName}`
  /// (creating the folder on first use) then opens the platform share sheet for
  /// the saved file. Returns the saved file path.
  Future<String> saveAndShare(Uint8List bytes, String fileName) async {
    final dir = await getApplicationDocumentsDirectory();
    final folder = Directory('${dir.path}${Platform.pathSeparator}payslips');
    await folder.create(recursive: true);
    final file = File(
      '${folder.path}${Platform.pathSeparator}$fileName',
    );
    await file.writeAsBytes(bytes, flush: true);
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path)],
        text: 'Slip gaji KaryawanKu',
      ),
    );
    return file.path;
  }
}