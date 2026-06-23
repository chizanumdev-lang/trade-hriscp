import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Img,
  Text,
  Row,
  Column,
} from '@react-email/components';
import React from 'react';

export const BaseTemplate = ({ children, previewText, headerTitle = "TradeVu HR" }) => {
  const currentYear = new Date().getFullYear();
  
  // Safely get base URL for images
  let baseUrl = 'https://trade-hriscp.vercel.app';
  try {
    if (typeof process !== 'undefined' && process.env.FRONTEND_URL) {
      baseUrl = process.env.FRONTEND_URL;
    }
  } catch (e) {
    // Ignore errors in environments without process
  }

  return (
    <Html>
      {previewText && <Preview>{previewText}</Preview>}
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brand: '#3b82f6', // Bright blue like the Figma button
              },
            },
          },
        }}
      >
        <Head>
          <title>{headerTitle}</title>
        </Head>
        <Body className="bg-[#f3f4f6] font-sans text-slate-800 py-10">
          <Container className="w-full max-w-[600px] mx-auto bg-white overflow-hidden shadow-sm">
            
            {/* Header (Logo & 3D Element) inside the card */}
            <Section className="px-8 md:px-10 pt-10 pb-4">
              <Row>
                <Column style={{ width: "60%", verticalAlign: "middle", textAlign: "left" }}>
                  <Img
                    src={`${baseUrl}/logo-icon.png`}
                    width="44"
                    height="44"
                    alt="TradeVu"
                    className="rounded-lg shadow-sm"
                  />
                </Column>
                <Column style={{ width: "40%", verticalAlign: "middle", textAlign: "right" }}>
                  <Img
                    src="/static/3d-shape.png"
                    width="140"
                    height="140"
                    alt="3D Shape"
                    style={{ display: "inline-block", marginRight: "-10px", marginTop: "-10px" }}
                  />
                </Column>
              </Row>
            </Section>

            {/* Main Content Card */}
            <Section className="px-8 md:px-10 pb-8 text-left">
              {children}
              
              <Text className="text-slate-700 text-[15px] leading-relaxed mt-8 mb-2">
                Need help? We're here if you need it. Reach out to <a href="mailto:support@tradevu.com" className="text-brand no-underline">HR Support</a>.
              </Text>
              <Text className="text-slate-700 text-[15px] m-0">
                - The TradeVu HR Team
              </Text>
            </Section>

            {/* Inner Footer (Unsubscribe/Disclaimer) */}
            <Section className="bg-[#f8fafc] px-10 py-8 border-t border-slate-100 text-center">
              <Text className="text-slate-500 text-[12px] leading-relaxed m-0">
                You're receiving this email because you are a registered user of TradeVu.
                If you feel you received it by mistake, please <a href="#" className="text-slate-700 font-semibold underline">contact us</a>.
              </Text>
            </Section>
            
          </Container>

          {/* Outer Footer (Copyright) */}
          <Section className="text-center mt-6">
            <Text className="text-slate-400 text-[12px] m-0 mb-1">
              Copyright &copy; {currentYear} TradeVu. All rights reserved.
            </Text>
            <Text className="text-slate-400 text-[12px] m-0">
              Lagos, Nigeria
            </Text>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default BaseTemplate;
