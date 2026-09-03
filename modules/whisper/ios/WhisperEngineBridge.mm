#import "WhisperEngineBridge.h"
#import "WhisperEngine.h"

static WhisperEngine g_engine;

@implementation WhisperEngineBridge

+ (instancetype)shared {
  static WhisperEngineBridge *instance = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    instance = [[WhisperEngineBridge alloc] init];
  });
  return instance;
}

- (BOOL)loadModel:(NSString *)path {
  return g_engine.loadModel(std::string([path UTF8String])) ? YES : NO;
}

- (NSString *)transcribePcm:(NSArray<NSNumber *> *)pcm threads:(int32_t)threads language:(NSString *)language translate:(BOOL)translate {
  std::vector<float> vec;
  vec.reserve(pcm.count);
  for (NSNumber *n in pcm) vec.push_back([n floatValue]);
  std::string result = g_engine.transcribePcm(vec, (int)threads, std::string([language UTF8String]), translate ? true : false);
  return [NSString stringWithUTF8String:result.c_str()];
}

- (void)unload {
  g_engine.unload();
}

- (int64_t)modelSizeBytes {
  return (int64_t)g_engine.getModelSizeBytes();
}

@end
