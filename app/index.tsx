import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowUpRight, CheckCircle2, Mail, Phone, Search, Zap } from 'lucide-react-native';
import React from 'react';
import {
  Image,
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import Animated, { FadeInDown, FadeInLeft, FadeInRight, FadeInUp } from 'react-native-reanimated';

const App = () => {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const contentPadding = isMobile ? 20 : isTablet ? 40 : '10%';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero Section */}
        <ImageBackground
          source={require('../assets/images/hero-background.png')}
          style={[
            styles.heroBackground,
            {
              height: isMobile ? 'auto' : height,
              minHeight: isMobile ? height : undefined,
              paddingBottom: isMobile ? 48 : 0
            }
          ]}
        >
          <View style={[styles.heroOverlay, { paddingHorizontal: contentPadding }]}>
            <SafeAreaView style={styles.topNav}>
              <Animated.View entering={FadeInDown.duration(800)} style={styles.logoContainer}>
                <Image
                  source={require('../assets/images/townaija-logo.png')}
                  style={{ width: isMobile ? 24 : 32, height: isMobile ? 24 : 32, borderRadius: 6 }}
                  resizeMode="contain"
                />
                <Text style={[styles.logoText, { fontSize: isMobile ? 20 : 24 }]}>TowNaija</Text>
              </Animated.View>
              {!isMobile && (
                <Animated.View entering={FadeInDown.duration(800).delay(200)} style={styles.navLinks}>
                  <TouchableOpacity><Text style={styles.navLink}>How It Works</Text></TouchableOpacity>
                  <TouchableOpacity><Text style={styles.navLink}>Why Us</Text></TouchableOpacity>
                  <TouchableOpacity><Text style={styles.navLink}>Testimonial</Text></TouchableOpacity>
                </Animated.View>
              )}
            </SafeAreaView>

            <View style={[
              styles.heroContent,
              {
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? 40 : 0
              }
            ]}>
              <Animated.View
                entering={FadeInLeft.duration(1000).delay(300)}
                style={[styles.heroTextContent, { width: isMobile ? '100%' : '50%' }]}
              >
                <Text style={[
                  styles.heroTitle,
                  {
                    fontSize: isMobile ? 40 : 64,
                    lineHeight: isMobile ? 48 : 72,
                    textAlign: isMobile ? 'center' : 'left'
                  }
                ]}>Your Roadside Rescue Partner</Text>
                <Text style={[
                  styles.heroDescription,
                  { textAlign: isMobile ? 'center' : 'left' }
                ]}>
                  TowNaija connects you with nearby tow truck operators for fast and reliable roadside assistance.
                </Text>
                <View style={[
                  styles.downloadButtons,
                  { justifyContent: isMobile ? 'center' : 'flex-start' }
                ]}>
                  <TouchableOpacity style={styles.downloadBtn} onPress={() => router.push('/splash')}>
                    <View style={styles.btnIconContainer}>
                      <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/000000/apple-app-store--v1.png' }} style={styles.btnIcon} />
                    </View>
                    <View>
                      <Text style={styles.btnSmallText}>Get Started</Text>
                      <Text style={styles.btnLargeText}>Web App</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: '#FACC15' }]} onPress={() => router.push('/splash')}>
                    <View style={styles.btnIconContainer}>
                      <Image source={{ uri: 'https://img.icons8.com/color/48/000000/google-play.png' }} style={styles.btnIcon} />
                    </View>
                    <View>
                      <Text style={styles.btnSmallText}>Explore</Text>
                      <Text style={styles.btnLargeText}>Mobile Flow</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              <Animated.View
                entering={FadeInRight.duration(1000).delay(600)}
                style={[
                  styles.heroMockupContainer,
                  {
                    width: isMobile ? '100%' : '45%',
                    height: isMobile ? 400 : '100%'
                  }
                ]}
              >
                <Image
                  source={require('../assets/images/hero-mockup.png')}
                  style={styles.heroMockup}
                  resizeMode="contain"
                />
              </Animated.View>
            </View>
          </View>
        </ImageBackground>

        {/* How It Works Section */}
        <View style={[styles.section, { paddingHorizontal: contentPadding, paddingVertical: isMobile ? 48 : 100 }]}>
          <View style={[
            styles.flexContent,
            { flexDirection: isMobile ? 'column-reverse' : 'row' }
          ]}>
            <Animated.View entering={FadeInLeft.duration(1000).delay(300)} style={[styles.mockupSide, { width: isMobile ? '100%' : '45%' }]}>
              <View style={styles.mockupGlow} />
              <Image
                source={require('../assets/images/how-it-works-mockup.png')}
                style={[styles.sectionMockup, { height: isMobile ? 400 : 600 }]}
                resizeMode="contain"
              />
            </Animated.View>

            <Animated.View entering={FadeInRight.duration(1000).delay(300)} style={[styles.textSide, { width: isMobile ? '100%' : '50%' }]}>
              <Text style={[styles.sectionTag, { textAlign: isMobile ? 'center' : 'left' }]}>HOW IT WORKS</Text>
              <Text style={[styles.sectionTitle, { textAlign: isMobile ? 'center' : 'left' }]}>Easy, Convenient, And Fast</Text>

              <View style={[styles.featureItem]}>
                <View style={styles.featureIconContainer}>
                  <Search size={24} color="#FACC15" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>Request A Tow</Text>
                  <Text style={styles.featureDesc}>Open the app, enter your location and request a tow.</Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Zap size={24} color="#FACC15" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>Get Matched</Text>
                  <Text style={styles.featureDesc}>We will connect you with nearby tow truck operators.</Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <CheckCircle2 size={24} color="#FACC15" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>Get Towed</Text>
                  <Text style={styles.featureDesc}>Track your tow truck arriving and get back on the road safely.</Text>
                </View>
              </View>
            </Animated.View>
          </View>
        </View>

        {/* Why Choose TowMe Section */}
        <View style={[styles.section, { paddingHorizontal: contentPadding, paddingVertical: isMobile ? 48 : 100 }]}>
          <View style={[
            styles.flexContent,
            { flexDirection: isMobile ? 'column-reverse' : 'row-reverse' }
          ]}>
            <Animated.View entering={FadeInRight.duration(1000).delay(300)} style={[styles.mockupSide, { width: isMobile ? '100%' : '45%' }]}>
              <Image
                source={require('../assets/images/why-us-mockup.png')}
                style={[styles.sectionMockup, { height: isMobile ? 400 : 600 }]}
                resizeMode="contain"
              />
            </Animated.View>

            <Animated.View entering={FadeInLeft.duration(1000).delay(300)} style={[styles.textSide, { width: isMobile ? '100%' : '50%' }]}>
              <Text style={[styles.sectionTag, { textAlign: isMobile ? 'center' : 'left' }]}>WHY US</Text>
              <Text style={[styles.sectionTitle, { textAlign: isMobile ? 'center' : 'left' }]}>Why Choose TowNaija</Text>
              <Text style={[styles.sectionDescription, { textAlign: isMobile ? 'center' : 'left' }]}>
                TowNaija provides 24/7 emergency assistance, connecting you with nearby, background-checked operators within minutes, ensuring real-time tracking, transparent pricing, and peace of mind on every voyage.
              </Text>
            </Animated.View>
          </View>
        </View>

        {/* Testimonials Section */}
        <ImageBackground
          source={require('../assets/images/testimonials-bg.png')}
          style={[styles.testimonialBg, { width }]}
        >
          <View style={[styles.testimonialOverlay, { paddingHorizontal: contentPadding, paddingVertical: isMobile ? 48 : 100 }]}>
            <Animated.View entering={FadeInUp.duration(1000)}>
              <Text style={styles.sectionTag}>TESTIMONIAL</Text>
              <Text style={styles.testimonialMainTitle}>What Our Users Say About Us?</Text>
            </Animated.View>

            <View style={[
              styles.testimonialContainer,
              { flexDirection: isDesktop ? 'row' : 'column', gap: isDesktop ? 100 : 60 }
            ]}>
              <Animated.View
                entering={FadeInLeft.duration(1000).delay(300)}
                style={[styles.avatarCloud, { transform: [{ scale: isMobile ? 0.7 : 1 }] }]}
              >
                {/* Central Large Avatar */}
                <View style={styles.centralAvatarContainer}>
                  <Image source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }} style={styles.centralAvatar} />
                  <View style={styles.quoteIcon}>
                    <Text style={styles.quoteMark}>“</Text>
                  </View>
                </View>
                {/* Surrounding Avatars */}
                <Image source={{ uri: 'https://randomuser.me/api/portraits/women/44.jpg' }} style={[styles.smallAvatar, { top: 0, left: 40 }]} />
                <Image source={{ uri: 'https://randomuser.me/api/portraits/men/46.jpg' }} style={[styles.smallAvatar, { top: 20, right: 20 }]} />
                <Image source={{ uri: 'https://randomuser.me/api/portraits/men/67.jpg' }} style={[styles.smallAvatar, { bottom: 20, left: 20 }]} />
                <Image source={{ uri: 'https://randomuser.me/api/portraits/women/68.jpg' }} style={[styles.smallAvatar, { bottom: 0, right: 60 }]} />
              </Animated.View>

              <Animated.View
                entering={FadeInRight.duration(1000).delay(500)}
                style={[styles.testimonialContent, { width: isMobile ? '100%' : isTablet ? '80%' : 500 }]}
              >
                <Text style={[styles.testimonialHeading, { textAlign: isMobile ? 'center' : 'left' }]}>My Roadside Guardian Angel!</Text>
                <Text style={[styles.testimonialText, { textAlign: isMobile ? 'center' : 'left' }]}>
                  This help was when my car broke down on that deserted road in the middle of the night. But TowNaija's rapid response restored my faith in roadside assistance. Their honesty, expertise and efficiency got me home safely. I'm grateful for their exceptional service and highly recommend TowNaija!
                </Text>
                <View style={[styles.testimonialAuthorRow, { justifyContent: isMobile ? 'center' : 'flex-start' }]}>
                  <View style={styles.miniAvatars}>
                    <Image source={{ uri: 'https://randomuser.me/api/portraits/men/1.jpg' }} style={styles.miniAvatar} />
                    <Image source={{ uri: 'https://randomuser.me/api/portraits/women/2.jpg' }} style={[styles.miniAvatar, { marginLeft: -10 }]} />
                    <Image source={{ uri: 'https://randomuser.me/api/portraits/men/3.jpg' }} style={[styles.miniAvatar, { marginLeft: -10 }]} />
                  </View>
                  <Text style={styles.authorName}>James Johnson</Text>
                </View>
              </Animated.View>
            </View>
          </View>
        </ImageBackground>

        {/* CTA Section */}
        <Animated.View
          entering={FadeInUp.duration(1000).delay(200)}
          style={[styles.ctaSection, { paddingHorizontal: contentPadding, paddingVertical: isMobile ? 48 : 100 }]}
        >
          <View style={[
            styles.ctaBox,
            {
              flexDirection: isMobile ? 'column' : 'row',
              padding: isMobile ? 30 : isTablet ? 60 : 80
            }
          ]}>
            <View style={[styles.ctaTextSide, { width: isMobile ? '100%' : '60%' }]}>
              <Text style={[styles.ctaTitle, { textAlign: isMobile ? 'center' : 'left' }]}>Ready To Get Started</Text>
              <Text style={[styles.ctaDesc, { textAlign: isMobile ? 'center' : 'left' }]}>
                Get started today! Register for TowNaija's roadside assistance and download our user-friendly app for easy access to our services. Your peace of mind awaits.
              </Text>
              <View style={[
                styles.downloadButtons,
                { marginTop: 20, justifyContent: isMobile ? 'center' : 'flex-start' }
              ]}>
                <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: '#fff' }]} onPress={() => router.push('/splash')}>
                  <View style={styles.btnIconContainer}>
                    <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/000000/apple-app-store--v1.png' }} style={styles.btnIcon} />
                  </View>
                  <View>
                    <Text style={[styles.btnSmallText, { color: '#000' }]}>Get Started</Text>
                    <Text style={[styles.btnLargeText, { color: '#000' }]}>Web App</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: '#fff' }]} onPress={() => router.push('/splash')}>
                  <View style={styles.btnIconContainer}>
                    <Image source={{ uri: 'https://img.icons8.com/color/48/000000/google-play.png' }} style={styles.btnIcon} />
                  </View>
                  <View>
                    <Text style={[styles.btnSmallText, { color: '#000' }]}>Explore</Text>
                    <Text style={[styles.btnLargeText, { color: '#000' }]}>Mobile Flow</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.ctaMockupSide, { width: isMobile ? '100%' : '30%' }]}>
              <Image
                source={require('../assets/images/hero-mockup.png')}
                style={styles.ctaMockup}
                resizeMode="contain"
              />
            </View>
          </View>
        </Animated.View>

        {/* Footer */}
        <View style={[
          styles.footer,
          {
            paddingHorizontal: contentPadding,
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 40 : 60
          }
        ]}>
          <View style={styles.footerCol}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/images/townaija-logo.png')}
                style={{ width: 32, height: 32, borderRadius: 6 }}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>TowNaija</Text>
            </View>
            <TouchableOpacity style={styles.footerInfo}>
              <Mail size={16} color="#FACC15" />
              <Text style={styles.footerInfoText}>Hello@TowNaija.com</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerInfo}>
              <Phone size={16} color="#FACC15" />
              <Text style={styles.footerInfoText}>+234 81 234 567 89</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.becomeDriverBtn}>
              <Text style={styles.becomeDriverText}>Become A Driver</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerCol}>
            <Text style={styles.footerHeader}>Legal</Text>
            <TouchableOpacity><Text style={styles.footerLink}>Terms of use</Text></TouchableOpacity>
            <TouchableOpacity><Text style={styles.footerLink}>Privacy</Text></TouchableOpacity>
            <TouchableOpacity><Text style={styles.footerLink}>Ship</Text></TouchableOpacity>
            <TouchableOpacity><Text style={styles.footerLink}>Cookies Policy</Text></TouchableOpacity>
          </View>

          <View style={styles.footerCol}>
            <Text style={styles.footerHeader}>Newsletter</Text>
            <Text style={styles.footerLink}>Sign up for news</Text>
            <View style={styles.newsletterInput}>
              <Text style={styles.inputPlaceholder}>Your email</Text>
              <ArrowUpRight size={20} color="#000" />
            </View>
          </View>
        </View>

        <View style={styles.bottomBar}>
          <Text style={styles.copyright}>© 2026 Copyright All rights Reserved TowNaija.com</Text>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  heroBackground: {
    width: '100%',
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 30,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    color: '#fff',
    fontFamily: 'Poppins_800ExtraBold',
  },
  navLinks: {
    flexDirection: 'row',
    gap: 40,
  },
  navLink: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_500Medium',
  },
  heroContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 40,
  },
  heroTextContent: {
    // Width set dynamically
  },
  heroTitle: {
    color: '#fff',
    marginBottom: 20,
    fontFamily: 'Poppins_800ExtraBold',
  },
  heroDescription: {
    fontSize: 18,
    color: '#94A3B8',
    lineHeight: 28,
    marginBottom: 40,
    fontFamily: 'Poppins_400Regular',
  },
  downloadButtons: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 10,
  },
  btnIconContainer: {
    width: 24,
    height: 24,
  },
  btnIcon: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  btnSmallText: {
    fontSize: 10,
    color: '#000',
    fontFamily: 'Poppins_400Regular',
  },
  btnLargeText: {
    fontSize: 14,
    color: '#000',
    fontFamily: 'Poppins_700Bold',
  },
  heroMockupContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroMockup: {
    width: '100%',
    height: '100%',
  },
  section: {
    paddingVertical: 100,
  },
  flexContent: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 60,
  },
  mockupSide: {
    alignItems: 'center',
    position: 'relative',
  },
  mockupGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    backgroundColor: '#FACC15',
    borderRadius: 150,
    opacity: 0.1,
    filter: 'blur(100px)',
  },
  sectionMockup: {
    width: '100%',
  },
  textSide: {
    // Width set dynamically
  },
  sectionTag: {
    color: '#FACC15',
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: 12,
    fontFamily: 'Poppins_700Bold',
  },
  sectionTitle: {
    fontSize: 40,
    color: '#fff',
    marginBottom: 40,
    fontFamily: 'Poppins_800ExtraBold',
  },
  sectionDescription: {
    fontSize: 18,
    color: '#94A3B8',
    lineHeight: 30,
    fontFamily: 'Poppins_400Regular',
  },
  featureItem: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 30,
  },
  featureIconContainer: {
    marginTop: 5,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'Poppins_700Bold',
  },
  featureDesc: {
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 24,
    fontFamily: 'Poppins_400Regular',
  },
  testimonialBg: {
    // Width set dynamically
  },
  testimonialOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingVertical: 100,
    alignItems: 'center',
  },
  testimonialMainTitle: {
    fontSize: 40,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 80,
    fontFamily: 'Poppins_800ExtraBold',
  },
  testimonialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCloud: {
    width: 400,
    height: 400,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centralAvatarContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    borderColor: '#FACC15',
    padding: 5,
  },
  centralAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 90,
  },
  quoteIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 50,
    height: 50,
    backgroundColor: '#FACC15',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quoteMark: {
    fontSize: 40,
    color: '#0F172A',
    fontWeight: '800',
    marginTop: 15,
  },
  smallAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: 'absolute',
  },
  testimonialContent: {
    // Width set dynamically
  },
  testimonialHeading: {
    fontSize: 28,
    color: '#fff',
    marginBottom: 20,
    fontFamily: 'Poppins_700Bold',
  },
  testimonialText: {
    fontSize: 18,
    color: '#94A3B8',
    lineHeight: 30,
    marginBottom: 30,
    fontFamily: 'Poppins_400Regular',
  },
  testimonialAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  miniAvatars: {
    flexDirection: 'row',
  },
  miniAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  authorName: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
  },
  ctaSection: {
    paddingVertical: 100,
  },
  ctaBox: {
    backgroundColor: '#FACC15',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  ctaTextSide: {
    // Width set dynamically
  },
  ctaTitle: {
    fontSize: 40,
    color: '#0F172A',
    marginBottom: 20,
    fontFamily: 'Poppins_800ExtraBold',
  },
  ctaDesc: {
    fontSize: 18,
    color: '#0F172A',
    opacity: 0.8,
    lineHeight: 28,
    fontFamily: 'Poppins_400Regular',
  },
  ctaMockupSide: {
    alignItems: 'center',
  },
  ctaMockup: {
    width: 300,
    height: 400,
  },
  footer: {
    backgroundColor: '#0F172A',
    paddingVertical: 100,
    justifyContent: 'space-between',
  },
  footerCol: {
    flex: 1,
    gap: 20,
    minWidth: 200,
  },
  footerHeader: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'Poppins_700Bold',
  },
  footerLink: {
    fontSize: 16,
    color: '#94A3B8',
    fontFamily: 'Poppins_400Regular',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerInfoText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
  },
  becomeDriverBtn: {
    backgroundColor: '#FACC15',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  becomeDriverText: {
    color: '#0F172A',
    fontFamily: 'Poppins_700Bold',
  },
  newsletterInput: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  inputPlaceholder: {
    color: '#94A3B8',
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
  },
  bottomBar: {
    paddingVertical: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  copyright: {
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
});

export default App;
