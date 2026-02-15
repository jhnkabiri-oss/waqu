import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { contacts } = await req.json();

        if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
            return NextResponse.json(
                { error: 'Invalid input. Expected array of { name, phone }' },
                { status: 400 }
            );
        }

        let vcf = '';
        for (const contact of contacts) {
            const name = contact.name.trim();
            const phone = contact.phone.replace(/[^0-9+]/g, '');

            vcf += `BEGIN:VCARD\r\n`;
            vcf += `VERSION:3.0\r\n`;
            vcf += `FN:${name}\r\n`;
            vcf += `N:${name};;;;\r\n`;
            vcf += `TEL;TYPE=CELL:${phone}\r\n`;
            vcf += `END:VCARD\r\n`;
        }

        return new Response(vcf, {
            headers: {
                'Content-Type': 'text/vcard',
                'Content-Disposition': `attachment; filename="contacts_${Date.now()}.vcf"`,
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to generate VCF: ' + (error as Error).message },
            { status: 500 }
        );
    }
}
