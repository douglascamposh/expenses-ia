#import <Foundation/Foundation.h>

@interface WhisperEngineBridge : NSObject
+ (instancetype)shared;
- (BOOL)loadModel:(NSString *)path;
- (NSString *)transcribePcm:(NSArray<NSNumber *> *)pcm threads:(int32_t)threads language:(NSString *)language translate:(BOOL)translate;
- (void)unload;
- (int64_t)modelSizeBytes;
@end
