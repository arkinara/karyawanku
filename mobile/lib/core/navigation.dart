import 'package:flutter/material.dart';

/// Root [NavigatorState] so non-widget code (the auth notifier's one-time
/// biometric enrolment dialog) can show UI without a BuildContext of its own.
final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();