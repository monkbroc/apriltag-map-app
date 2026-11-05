Pod::Spec.new do |s|
  s.name           = 'ApriltagAr'
  s.version        = '0.1.0'
  s.summary        = 'AprilTag detection on ARKit frames'
  s.description    = 'Runs the AprilTag 3 detector on ARKit camera frames and reports tag poses in the AR world frame.'
  s.author         = 'Julien Vanier'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = 'BSD-2-Clause'
  s.platforms      = { :ios => '16.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ARKit', 'AVFoundation'

  s.source_files = 'ios/**/*.swift', 'cpp/atag_bridge.{h,c}', 'cpp/apriltag/**/*.{h,c}'
  s.public_header_files = 'cpp/atag_bridge.h'
  s.private_header_files = 'cpp/apriltag/**/*.h'
  s.compiler_flags = '-O3 -w'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'HEADER_SEARCH_PATHS' => '"${PODS_TARGET_SRCROOT}/cpp" "${PODS_TARGET_SRCROOT}/cpp/apriltag"',
    'GCC_OPTIMIZATION_LEVEL' => '3',
  }
end
